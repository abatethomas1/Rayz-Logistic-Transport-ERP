FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 app
COPY . .
RUN mkdir -p /data/private-documents && chown -R app:app /data /app
EXPOSE 8000
CMD ["sh", "start.sh"]