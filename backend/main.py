from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import shutil
from datetime import datetime
import sqlite3
from typing import List
import json

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
                  filename TEXT NOT NULL,
                  original_filename TEXT NOT NULL,
                  upload_date TEXT NOT NULL,
                  file_size INTEGER NOT NULL)''')
    conn.commit()
    conn.close()

init_db()

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Генерируем уникальное имя файла
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Получаем размер файла
        file_size = os.path.getsize(file_path)
        
        # Сохраняем информацию о файле в базу данных
        conn = sqlite3.connect('files.db')
        c = conn.cursor()
        c.execute('''INSERT INTO files (filename, original_filename, upload_date, file_size)
                     VALUES (?, ?, ?, ?)''',
                  (unique_filename, file.filename, datetime.now().isoformat(), file_size))
        conn.commit()
        conn.close()
        
        return {"message": "File uploaded successfully", "filename": unique_filename}
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

@app.get("/download/{filename}")
async def download_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
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