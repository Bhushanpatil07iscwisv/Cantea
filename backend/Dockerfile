FROM python:3.12-slim
WORKDIR /app
COPY requirements-lock.txt .
RUN pip install --no-cache-dir -r requirements-lock.txt && useradd -m cantea && mkdir /data && chown cantea:cantea /data
COPY --chown=cantea:cantea . .
USER cantea
ENV DB_PATH=/data/cantea.db
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
