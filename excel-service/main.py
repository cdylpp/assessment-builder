from io import BytesIO
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from openpyxl import Workbook

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/generate")
def generate():
    wb = Workbook()
    ws = wb.active
    ws["A1"] = "TODO: Excel Generator"
    stream = BytesIO()
    wb.save(stream)
    return Response(
        stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )