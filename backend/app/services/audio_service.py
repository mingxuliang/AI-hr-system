import os
from http import HTTPStatus
import dashscope
from dashscope.audio.asr import Recognition
from dotenv import load_dotenv
from pydub import AudioSegment

load_dotenv()

# Configure DashScope API Key
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

def transcribe_audio(audio_file_path: str) -> str:
    """
    Transcribe audio file using DashScope ASR SDK (FunASR).
    Requires 'dashscope' and 'pydub' packages.
    """
    if not os.path.exists(audio_file_path):
        return ""
        
    try:
        # 1. Convert audio to WAV format with 16k sample rate (required by FunASR)
        # Input might be webm or other formats
        sound = AudioSegment.from_file(audio_file_path)
        sound = sound.set_frame_rate(16000).set_channels(1)
        
        # Create a temporary wav file
        wav_path = audio_file_path + ".wav"
        sound.export(wav_path, format="wav")
        
        # 2. Call DashScope ASR
        recognition = Recognition(
            model='fun-asr-realtime-2025-11-07', # Or 'paraformer-realtime-v1' if that's more stable
            # The user suggested 'fun-asr-realtime-2025-11-07', let's try it. 
            # If it fails, we might fall back to 'paraformer-realtime-v1'
            format='wav',
            sample_rate=16000,
            language_hints=['zh', 'en'],
            callback=None
        )
        
        # recognition.call accepts a file path
        result = recognition.call(wav_path)
        
        # Clean up temp file
        if os.path.exists(wav_path):
            os.remove(wav_path)
            
        if result.status_code == HTTPStatus.OK:
            # result.get_sentence() might return a list of dicts or a single dict
            sentences = result.get_sentence()
            if not sentences:
                 print(f"ASR Result: {result}")
                 return ""
            
            # If it's a list, join texts
            if isinstance(sentences, list):
                text_list = []
                for s in sentences:
                    if isinstance(s, dict) and 'text' in s:
                        text_list.append(s['text'])
                return " ".join(text_list)
            
            # If it's a single dict (as error suggests: object with keys {text, ...})
            if isinstance(sentences, dict) and 'text' in sentences:
                return sentences['text']
                
            # Fallback
            return str(sentences)
        else:
            print(f"ASR Error: {result.message}")
            return f"[语音转写失败: {result.message}]"
            
    except Exception as e:
        print(f"Transcription process failed: {e}")
        return f"[语音转写异常: {str(e)}]"
