FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY services/photo-verification-worker/requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

COPY services/photo-verification-worker/download_models.py /app/download_models.py
RUN mkdir -p /models && MODEL_DIR=/models python /app/download_models.py

COPY services/photo-verification-worker/app.py /app/app.py

RUN useradd --create-home --uid 10001 worker \
    && chown -R worker:worker /app /models
USER worker

EXPOSE 8080

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1 --no-access-log"]
