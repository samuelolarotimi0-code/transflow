# ============================================================
# Transcription Service Dockerfile
# Node 22 + Python 3.11 + ffmpeg + openai-whisper
# ============================================================
FROM node:22-bookworm-slim

WORKDIR /app

# ---- System deps: ffmpeg, Python, pip ----------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        python3-pip \
        python3-venv \
        && rm -rf /var/lib/apt/lists/*

# ---- Python venv + openai-whisper --------------------------
# Whisper downloads the model on first use; mount a volume at
# /root/.cache/whisper in production to persist it.
RUN python3 -m venv /opt/whisper-venv && \
    /opt/whisper-venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/whisper-venv/bin/pip install --no-cache-dir openai-whisper

ENV LOCAL_ASR_PYTHON=/opt/whisper-venv/bin/python
ENV WHISPER_MODEL=base

# ---- Node deps (mini-service only) -------------------------
COPY mini-services/transcription-service/package.json \
     mini-services/transcription-service/package-lock.json \
     ./mini-services/transcription-service/

RUN npm ci --prefix mini-services/transcription-service

# ---- Application source ------------------------------------
# Copy the full repo so local-asr.ts can resolve relative paths correctly
COPY src/lib/local-asr.ts ./src/lib/local-asr.ts
COPY mini-services/transcription-service/index.ts \
     mini-services/transcription-service/local_asr.py \
     mini-services/transcription-service/

# ---- Runtime -----------------------------------------------
EXPOSE 3003
ENV PORT=3003

CMD ["npx", "tsx", "mini-services/transcription-service/index.ts"]
