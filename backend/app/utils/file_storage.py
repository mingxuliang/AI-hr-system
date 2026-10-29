import os
import shutil
from fastapi import HTTPException, UploadFile
from uuid import uuid4

RESUME_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md", ".markdown"}
MAX_RESUME_BYTES = 10 * 1024 * 1024

UPLOAD_DIR = "uploads"

if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def save_upload_file(upload_file: UploadFile, sub_dir: str = "") -> str:
    target_dir = os.path.join(UPLOAD_DIR, sub_dir)
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
    
    file_extension = os.path.splitext(upload_file.filename)[1]
    filename = f"{uuid4()}{file_extension}"
    file_path = os.path.join(target_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
        
    return file_path


def validate_resume_file(file: UploadFile):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in RESUME_EXTENSIONS:
        raise HTTPException(status_code=400, detail="只支持 PDF、Word（doc/docx）、TXT、Markdown")
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_RESUME_BYTES:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10MB")
    if size == 0:
        raise HTTPException(status_code=400, detail="文件为空")
    return file
