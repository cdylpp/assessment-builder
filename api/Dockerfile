FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cahce-dir fastapi uvicorn sqlalchemy psycopg[binary] pydantic pyyaml httpx alembic
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]