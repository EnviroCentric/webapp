FROM python:3.11-slim

WORKDIR /app

# Set PYTHONPATH to ensure proper module resolution
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y \
    libpq-dev gcc postgresql-client && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Make the startup script executable
RUN chmod +x /app/scripts/start.sh

EXPOSE 8000

CMD ["sh", "/app/scripts/start.sh"] 