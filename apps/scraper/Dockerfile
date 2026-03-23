# apps/scraper/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements first — pip install layer is cached until requirements change
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source as the 'scraper' package so "from scraper.xxx" imports resolve
COPY . ./scraper/

EXPOSE 8000

CMD ["uvicorn", "scraper.main:app", "--host", "0.0.0.0", "--port", "8000"]
