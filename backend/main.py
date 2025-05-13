from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import shutil
from datetime import datetime
import sqlite3
from typing import List
import json
import random
import string
import logging

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаем директорию для загрузки файлов, если она не существует
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Инициализация базы данных
def init_db():
    conn = sqlite3.connect('files.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS files
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  file_id TEXT NOT NULL UNIQUE,
                  filename TEXT NOT NULL,
                  original_filename TEXT NOT NULL,
                  upload_date TEXT NOT NULL,
                  file_size INTEGER NOT NULL,
                  expires_at INTEGER NOT NULL)''')
    conn.commit()
    conn.close()

init_db()

# Генерация короткого уникального file_id
def generate_file_id(length=6):
    chars = string.ascii_letters + string.digits
    conn = sqlite3.connect('files.db')
    c = conn.cursor()
    while True:
        file_id = ''.join(random.choices(chars, k=length))
        c.execute('SELECT 1 FROM files WHERE file_id = ?', (file_id,))
        if not c.fetchone():
            break
    conn.close()
    return file_id

def cleanup_expired_files():
    now = int(datetime.now().timestamp())
    conn = sqlite3.connect('files.db')
    c = conn.cursor()
    c.execute('SELECT file_id, filename, expires_at FROM files WHERE expires_at <= ?', (now,))
    expired = c.fetchall()
    for file_id, filename, _ in expired:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        c.execute('DELETE FROM files WHERE file_id = ?', (file_id,))
    conn.commit()
    conn.close()

MAX_FILE_SIZE = int(1.5 * 1024 * 1024 * 1024)  # 1.5 GB

EXPIRE_OPTIONS = {
    '5m': 5 * 60,
    '15m': 15 * 60,
    '1h': 60 * 60,
    '12h': 12 * 60 * 60,
    '24h': 24 * 60 * 60,
}

@app.post("/upload/")
async def upload_file(
    file: UploadFile = File(...),
    expire: str = Form('1h')
):
    try:
        print(f"Получен файл: {file.filename}, expire: {expire}")
        cleanup_expired_files()
        # Проверка имени файла
        if '/' in file.filename or '\\' in file.filename:
            raise HTTPException(status_code=400, detail="Недопустимое имя файла")
        # Проверка времени хранения
        if expire not in EXPIRE_OPTIONS:
            raise HTTPException(status_code=400, detail="Недопустимый срок хранения")
        # Генерируем короткий уникальный file_id
        file_id = generate_file_id()
        # Генерируем уникальное имя файла
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        # Сохраняем файл
        size = 0
        CHUNK_SIZE = 1024 * 1024  # 1 MB
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 1.5 ГБ)")
                buffer.write(chunk)
        file.file.close()
        # Получаем размер файла
        file_size = os.path.getsize(file_path)
        # Время истечения жизни файла
        now = int(datetime.now().timestamp())
        expires_at = now + EXPIRE_OPTIONS[expire]
        # Сохраняем информацию о файле в базу данных
        conn = sqlite3.connect('files.db')
        c = conn.cursor()
        c.execute('''INSERT INTO files (file_id, filename, original_filename, upload_date, file_size, expires_at)
                     VALUES (?, ?, ?, ?, ?, ?)''',
                  (file_id, unique_filename, file.filename, datetime.now().isoformat(), file_size, expires_at))
        conn.commit()
        conn.close()
        return {
            "file_id": file_id,
            "filename": file.filename,
            "mimetype": file.content_type,
            "expires_at": expires_at
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files/")
async def list_files():
    try:
        conn = sqlite3.connect('files.db')
        c = conn.cursor()
        c.execute('SELECT * FROM files ORDER BY upload_date DESC')
        files = c.fetchall()
        conn.close()
        
        return [
            {
                "id": file[0],
                "filename": file[1],
                "original_filename": file[2],
                "upload_date": file[3],
                "file_size": file[4]
            }
            for file in files
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{file_id}")
async def download_file(file_id: str):
    cleanup_expired_files()
    conn = sqlite3.connect('files.db')
    c = conn.cursor()
    c.execute('SELECT filename, original_filename, expires_at FROM files WHERE file_id = ?', (file_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Файл не найден или срок хранения истёк")
    unique_filename, original_filename, expires_at = row
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Файл не найден или срок хранения истёк")
    return FileResponse(
        path=file_path,
        filename=original_filename,
        media_type='application/octet-stream'
    )

@app.delete("/files/{filename}")
async def delete_file(filename: str):
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Удаляем файл
        os.remove(file_path)
        
        # Удаляем запись из базы данных
        conn = sqlite3.connect('files.db')
        c = conn.cursor()
        c.execute('DELETE FROM files WHERE filename = ?', (filename,))
        conn.commit()
        conn.close()
        
        return {"message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 