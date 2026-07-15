"""
语音服务：ASR（转写）/ TTS（合成）

默认跟随系统模型配置中的 Provider：
- siliconflow：使用硅基流动 OpenAI 兼容音频接口
- dashscope：ASR 回退到 DashScope Recognition（兼容旧配置）
"""
from __future__ import annotations

import os
import logging
import mimetypes
import subprocess
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_ASR_MODEL = "FunAudioLLM/SenseVoiceSmall"
DEFAULT_TTS_MODEL = "FunAudioLLM/CosyVoice2-0.5B"
DEFAULT_TTS_VOICE = "FunAudioLLM/CosyVoice2-0.5B:alex"


def _get_audio_config() -> Dict[str, Any]:
    """读取系统配置，供 ASR/TTS 共用同一套 Key。"""
    from app.config.database import SessionLocal
    from app.models.models import SystemConfig

    db = SessionLocal()
    try:
        cfg = db.query(SystemConfig).order_by(SystemConfig.updated_at.desc()).first()
        provider = (cfg.llm_provider if cfg else None) or os.getenv("LLM_PROVIDER", "siliconflow")
        base_url = (cfg.llm_base_url if cfg else None) or ""
        api_key = (cfg.llm_api_key if cfg else None) or os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY") or os.getenv("DASHSCOPE_API_KEY")
        asr_model = (getattr(cfg, "asr_model", None) if cfg else None) or DEFAULT_ASR_MODEL
        tts_model = (getattr(cfg, "tts_model", None) if cfg else None) or DEFAULT_TTS_MODEL
        tts_voice = (getattr(cfg, "tts_voice", None) if cfg else None) or DEFAULT_TTS_VOICE

        # Base URL 含 siliconflow 时也视为硅基流动
        if "siliconflow" in (base_url or "").lower():
            provider = "siliconflow"
            if not base_url:
                base_url = SILICONFLOW_BASE_URL
        if provider == "siliconflow" and not base_url:
            base_url = SILICONFLOW_BASE_URL

        return {
            "provider": provider,
            "base_url": (base_url or SILICONFLOW_BASE_URL).rstrip("/"),
            "api_key": (api_key or "").strip() or None,
            "asr_model": asr_model,
            "tts_model": tts_model,
            "tts_voice": tts_voice,
        }
    finally:
        db.close()


def _guess_mime(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    if mime:
        return mime
    ext = os.path.splitext(path)[1].lower()
    return {
        ".webm": "audio/webm",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
    }.get(ext, "application/octet-stream")


def _get_ffmpeg_exe() -> str:
    import shutil
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def _convert_to_mp3(audio_file_path: str) -> str:
    """
    浏览器录音多为 webm/ogg；硅基流动 SenseVoice 对 webm 常返回空文本。
    统一转成 mp3 再送 ASR。
    """
    ext = os.path.splitext(audio_file_path)[1].lower()
    if ext == ".mp3":
        return audio_file_path

    mp3_path = os.path.splitext(audio_file_path)[0] + ".asr.mp3"
    cmd = [
        _get_ffmpeg_exe(), "-y", "-i", audio_file_path,
        "-ar", "16000", "-ac", "1", "-f", "mp3", mp3_path,
    ]
    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore"
    )
    if result.returncode != 0 or not os.path.exists(mp3_path):
        raise RuntimeError(f"音频转码失败: {(result.stderr or '')[-300:]}")
    return mp3_path


def _transcribe_siliconflow(audio_file_path: str, cfg: Dict[str, Any]) -> dict:
    api_key = cfg.get("api_key")
    if not api_key:
        raise RuntimeError(
            "未配置 API Key。请在系统设置 → 模型配置中选择硅基流动并填写 API Key。"
        )

    converted_path = None
    try:
        # SenseVoice 对 browser webm/ogg 常返回空文本，统一转成 mp3
        ext = os.path.splitext(audio_file_path)[1].lower()
        if ext == ".mp3":
            upload_path = audio_file_path
        else:
            converted_path = _convert_to_mp3(audio_file_path)
            upload_path = converted_path

        url = f"{cfg['base_url']}/audio/transcriptions"
        model = cfg.get("asr_model") or DEFAULT_ASR_MODEL
        filename = os.path.basename(upload_path)

        with open(upload_path, "rb") as audio_file:
            files = {
                "file": (filename, audio_file, _guess_mime(upload_path)),
            }
            data = {"model": model}
            headers = {"Authorization": f"Bearer {api_key}"}
            with httpx.Client(timeout=120.0) as client:
                resp = client.post(url, headers=headers, files=files, data=data)

        if resp.status_code != 200:
            raise RuntimeError(f"硅基流动 ASR 失败 ({resp.status_code}): {resp.text[:500]}")

        payload = resp.json() if resp.content else {}
        text = ""
        if isinstance(payload, dict):
            text = payload.get("text") or payload.get("result") or ""
            if not text and isinstance(payload.get("data"), dict):
                text = payload["data"].get("text", "")
        elif isinstance(payload, str):
            text = payload

        text = (text or "").strip()
        segments = []
        if text:
            segments.append({"speaker": "说话人1", "text": text, "start": 0, "end": 0})
        else:
            logger.warning("SiliconFlow ASR returned empty text for %s", audio_file_path)

        return {"text": text, "segments": segments}
    finally:
        if converted_path and os.path.exists(converted_path):
            try:
                os.remove(converted_path)
            except OSError:
                pass


def _transcribe_dashscope(audio_file_path: str, api_key: Optional[str]) -> dict:
    """旧版 DashScope ASR 兼容路径。"""
    from http import HTTPStatus
    import dashscope
    from dashscope.audio.asr import Recognition

    if not api_key:
        raise RuntimeError("未配置 DashScope API Key")

    dashscope.api_key = api_key

    wav_path = audio_file_path + ".wav"
    try:
        cmd = [
            _get_ffmpeg_exe(), "-y", "-i", audio_file_path,
            "-ar", "16000", "-ac", "1", "-f", "wav", wav_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
        if result.returncode != 0 or not os.path.exists(wav_path):
            raise RuntimeError(f"音频转码失败: {(result.stderr or '')[-300:]}")

        recognition = Recognition(
            model="paraformer-realtime-v2",
            format="wav",
            sample_rate=16000,
            language_hints=["zh", "en"],
            callback=None,
        )
        asr_result = recognition.call(wav_path)
        if asr_result.status_code != HTTPStatus.OK:
            raise RuntimeError(asr_result.message)

        sentences = asr_result.get_sentence() or []
        segments = []
        full_text = ""
        if isinstance(sentences, list):
            for idx, s in enumerate(sentences):
                if not isinstance(s, dict):
                    continue
                text = s.get("text", "")
                start = s.get("begin_time", 0) / 1000.0
                end = s.get("end_time", 0) / 1000.0
                speaker = s.get("speaker", f"说话人{(idx % 2) + 1}")
                segments.append({
                    "speaker": speaker,
                    "text": text,
                    "start": round(start, 2),
                    "end": round(end, 2),
                })
                full_text += text + " "
        elif isinstance(sentences, dict):
            full_text = sentences.get("text", "")
            segments.append({"speaker": "说话人1", "text": full_text, "start": 0, "end": 0})
        else:
            full_text = str(sentences)
            segments.append({"speaker": "说话人1", "text": full_text, "start": 0, "end": 0})

        return {"text": full_text.strip(), "segments": segments}
    finally:
        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except OSError:
                pass


def transcribe_audio(audio_file_path: str, enable_diarization: bool = True) -> dict:
    """
    转写音频。默认优先硅基流动 SenseVoice；Provider 为 dashscope 时走旧接口。
    """
    if not os.path.exists(audio_file_path):
        return {"text": "", "segments": []}

    try:
        cfg = _get_audio_config()
        provider = (cfg.get("provider") or "siliconflow").lower()

        if provider == "dashscope":
            return _transcribe_dashscope(audio_file_path, cfg.get("api_key"))

        # siliconflow / openai_compatible 等默认走硅基流动兼容接口
        # 若 base_url 不是 siliconflow，仍按 OpenAI 兼容 /audio/transcriptions 调用
        return _transcribe_siliconflow(audio_file_path, cfg)
    except Exception as e:
        logger.error("Transcription process failed: %s", e)
        return {"text": f"[语音转写异常: {str(e)}]", "segments": []}


def transcribe_audio_simple(audio_file_path: str) -> str:
    result = transcribe_audio(audio_file_path)
    return result.get("text", "")


def format_transcript_for_display(transcript_data: dict) -> str:
    if isinstance(transcript_data, str):
        return transcript_data

    segments = transcript_data.get("segments", [])
    if not segments:
        return transcript_data.get("text", "")

    lines = []
    for seg in segments:
        speaker = seg.get("speaker", "说话人")
        text = seg.get("text", "")
        timestamp = f"[{seg.get('start', 0):.1f}s]"
        lines.append(f"{timestamp} {speaker}: {text}")
    return "\n".join(lines)


def synthesize_speech(
    text: str,
    output_path: Optional[str] = None,
    *,
    model: Optional[str] = None,
    voice: Optional[str] = None,
    response_format: str = "mp3",
) -> bytes:
    """
    文本转语音（硅基流动默认 CosyVoice2）。
    返回音频二进制；若传入 output_path 则同时写入文件。
    """
    if not (text or "").strip():
        raise ValueError("TTS 文本不能为空")

    cfg = _get_audio_config()
    api_key = cfg.get("api_key")
    if not api_key:
        raise RuntimeError("未配置 API Key，无法使用 TTS。请在系统设置中配置硅基流动密钥。")

    provider = (cfg.get("provider") or "siliconflow").lower()
    base_url = cfg.get("base_url") or SILICONFLOW_BASE_URL
    if provider == "dashscope" and "siliconflow" not in base_url.lower():
        # TTS 统一走硅基流动（用户要求默认使用硅基流动）
        base_url = SILICONFLOW_BASE_URL

    url = f"{base_url.rstrip('/')}/audio/speech"
    payload = {
        "model": model or cfg.get("tts_model") or DEFAULT_TTS_MODEL,
        "input": text.strip(),
        "voice": voice or cfg.get("tts_voice") or DEFAULT_TTS_VOICE,
        "response_format": response_format,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=120.0) as client:
        resp = client.post(url, headers=headers, json=payload)

    if resp.status_code != 200:
        raise RuntimeError(f"硅基流动 TTS 失败 ({resp.status_code}): {resp.text[:500]}")

    audio_bytes = resp.content
    if output_path:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
    return audio_bytes
