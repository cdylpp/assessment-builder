from fastapi import FastAPI
from app.routes import router
from app.db import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Assessment Builder API")
app.include_router(router)

@app.get("/health")
def health():
    return {"status":"ok"}