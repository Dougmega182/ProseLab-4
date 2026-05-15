FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# If it's a service, it should probably run a web server.
# For now, we'll just keep it alive or run a simple health check.
CMD ["python", "app.py"]
