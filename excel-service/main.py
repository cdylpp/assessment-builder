from io import BytesIO
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from openpyxl import Workbook
from openpyxl.worksheet.table import Table, TableStyleInfo

# TODO: define styled templates using .xltx

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/generate")
def generate(payload: dict):
    wb = Workbook()
    ws = wb.active
    ws.title = "Assessment Template"

    ws.append(["Evolution", "Metric", "Type", "Domain", "Score", "Notes"])

    for evolution in payload["event"]["evolution"]:
        for metric in evolution["metrics"]:
            ws.append([
                evolution["name"],
                metric["name"],
                metric["type"],
                metric["domain"],
                "",
                ""
            ])
    
    last_row = ws.max_row
    table = Table(displayName="AssessmentMetrics", ref=f'A1:F{last_row}')
    style = TableStyleInfo(
        name="TableStyleMedium9",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    table.tableStyleInfo = style
    ws.add_table(table)
    stream = BytesIO()
    wb.save(stream)
    return Response(
        stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
