FROM python:3.11-slim

WORKDIR /srv

RUN pip install --no-cache-dir uv

COPY pyproject.toml ./
COPY app ./app

RUN uv pip install --system .

EXPOSE 8000 9100

CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
