from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import shutil
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional
import sqlite3
from pathlib import Path

app = FastAPI(title="FileShare")

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаем директории для файлов и базу данных
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Инициализация базы данных
def init_db():
    conn = sqlite3.connect('files.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS files
                 (id TEXT PRIMARY KEY, filename TEXT, password TEXT, 
                  upload_date TIMESTAMP, expiry_date TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

def generate_id():
    """Генерация уникального ID для файла"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), password: Optional[str] = None):
    """Загрузка файла"""
    file_id = generate_id()
    file_path = UPLOAD_DIR / file_id
    
    # Сохраняем файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Сохраняем информацию в базу данных
    conn = sqlite3.connect('files.db')
    c = conn.cursor()
    c.execute('''INSERT INTO files (id, filename, password, upload_date, expiry_date)
                 VALUES (?, ?, ?, ?, ?)''',
              (file_id, file.filename, password, datetime.now(),
               datetime.now() + timedelta(days=7)))
    conn.commit()
    conn.close()
    
    return {"file_id": file_id, "filename": file.filename}

@app.get("/download/{file_id}")
async def download_file(file_id: str, password: Optional[str] = None):
    """Скачивание файла"""
    conn = sqlite3.connect('files.db')
    c = conn.cursor()
    c.execute('SELECT filename, password FROM files WHERE id = ?', (file_id,))
    result = c.fetchone()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    filename, stored_password = result
    
    if stored_password and stored_password != password:
        raise HTTPException(status_code=403, detail="Неверный пароль")
    
    file_path = UPLOAD_DIR / file_id
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 