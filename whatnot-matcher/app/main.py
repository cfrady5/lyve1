"""
FastAPI web server for Whatnot Slot Matcher.
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
from typing import Optional
import io

from app.matcher import load_csv, match, export_csv

app = FastAPI(title="Whatnot Slot Matcher", version="1.0.0")

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Setup templates
templates = Jinja2Templates(directory="app/templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the main UI page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/match")
async def match_endpoint(
    file: UploadFile = File(...),
    mode: str = Form("auto"),
    start_slot: int = Form(1),
    exclude_keywords: str = Form(""),
    include_keywords: str = Form("")
):
    """
    Match uploaded CSV to inventory slots.

    Args:
        file: CSV file upload
        mode: Matching mode (auto, sku, or sequence)
        start_slot: Starting slot number
        exclude_keywords: Comma-separated keywords to exclude
        include_keywords: Comma-separated keywords to include

    Returns:
        JSON with matched data and summary
    """
    try:
        # Validate mode
        if mode not in ["auto", "sku", "sequence"]:
            raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")

        # Validate start_slot
        if start_slot < 1:
            raise HTTPException(status_code=400, detail="start_slot must be >= 1")

        # Read file
        file_bytes = await file.read()

        # Load CSV
        df = load_csv(file_bytes)

        # Parse keywords
        exclude_list = [k.strip() for k in exclude_keywords.split(',') if k.strip()]
        include_list = [k.strip() for k in include_keywords.split(',') if k.strip()]

        # Match
        matched_df, summary = match(
            df,
            mode=mode,
            start_slot=start_slot,
            exclude_keywords=exclude_list,
            include_keywords=include_list
        )

        # Convert to JSON-friendly format
        # Limit preview to first 25 rows
        preview_df = matched_df.head(25)

        response = {
            "summary": summary,
            "preview": preview_df.to_dict(orient="records"),
            "columns": list(matched_df.columns),
            "total_rows": len(matched_df)
        }

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.post("/download")
async def download_endpoint(
    file: UploadFile = File(...),
    mode: str = Form("auto"),
    start_slot: int = Form(1),
    exclude_keywords: str = Form(""),
    include_keywords: str = Form("")
):
    """
    Match and download CSV.

    Returns:
        CSV file with slot assignments
    """
    try:
        # Validate inputs
        if mode not in ["auto", "sku", "sequence"]:
            raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")

        if start_slot < 1:
            raise HTTPException(status_code=400, detail="start_slot must be >= 1")

        # Read file
        file_bytes = await file.read()

        # Load CSV
        df = load_csv(file_bytes)

        # Parse keywords
        exclude_list = [k.strip() for k in exclude_keywords.split(',') if k.strip()]
        include_list = [k.strip() for k in include_keywords.split(',') if k.strip()]

        # Match
        matched_df, summary = match(
            df,
            mode=mode,
            start_slot=start_slot,
            exclude_keywords=exclude_list,
            include_keywords=include_list
        )

        # Export to CSV
        csv_bytes = export_csv(matched_df)

        # Return as downloadable file
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=matched_orders.csv"
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
