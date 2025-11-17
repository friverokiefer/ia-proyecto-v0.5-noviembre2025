# =========================
# ia-engine/Dockerfile
# Motor de IA (FastAPI + Uvicorn)
# =========================

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias del sistema mínimas
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiamos solo lo necesario para instalar deps primero (mejor cache)
COPY requirements.txt ./

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copiamos el código de la app
COPY app ./app

# Puerto por defecto de FastAPI/Uvicorn
EXPOSE 8000

# Variables de entorno típicas (ajustables en runtime)
ENV OPENAI_API_KEY=""
ENV ANTHROPIC_API_KEY=""

# Comando de arranque
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
