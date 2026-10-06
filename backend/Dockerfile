FROM python:3.11-slim

WORKDIR /app

# System dependencies for PyMuPDF, pdfplumber, faster-whisper — plan §15.1
RUN apt-get update && apt-get install -y --no-install-recommends \
    # PyMuPDF (fitz) system libs
    libmupdf-dev \
    libfreetype6-dev \
    # faster-whisper / ffmpeg for audio
    ffmpeg \
    # General utilities
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default: API server — plan §15.1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
