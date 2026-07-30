import os
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import init_db, get_db, MaintenanceRequest

app = FastAPI(title="Maintenance Request Tracker API")

# using "*" here to keep local dev simple - if this ever needs to be more
# locked down, swap it for the actual Vercel domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


# ---------- Schemas ----------

class RequestCreate(BaseModel):
    property: str
    unit: str
    category: str
    description: str


class RequestUpdate(BaseModel):
    status: str


class RequestOut(BaseModel):
    id: int
    property: str
    unit: str
    category: str
    description: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CategorySuggestRequest(BaseModel):
    description: str


class CategorySuggestResponse(BaseModel):
    suggested_category: str
    source: str  # "rules" or "ai"


# ---------- Routes ----------

@app.get("/")
def root():
    return {"status": "ok", "service": "Maintenance Request Tracker API"}


@app.post("/requests", response_model=RequestOut)
def create_request(req: RequestCreate, db: Session = Depends(get_db)):
    record = MaintenanceRequest(
        property=req.property,
        unit=req.unit,
        category=req.category,
        description=req.description,
        status="Open",
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/requests", response_model=List[RequestOut])
def list_requests(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(MaintenanceRequest)
    if status:
        query = query.filter(MaintenanceRequest.status == status)
    return query.order_by(MaintenanceRequest.created_at.desc()).all()


@app.get("/requests/summary")
def summary(db: Session = Depends(get_db)):
    counts = {"Open": 0, "In Progress": 0, "Completed": 0}
    rows = (
        db.query(MaintenanceRequest.status, MaintenanceRequest.id)
        .all()
    )
    for status, _ in rows:
        counts[status] = counts.get(status, 0) + 1
    return counts


@app.put("/requests/{request_id}", response_model=RequestOut)
def update_request(request_id: int, update: RequestUpdate, db: Session = Depends(get_db)):
    record = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Request not found")
    record.status = update.status
    db.commit()
    db.refresh(record)
    return record


@app.delete("/requests/{request_id}")
def delete_request(request_id: int, db: Session = Depends(get_db)):
    record = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Request not found")
    db.delete(record)
    db.commit()
    return {"deleted": request_id}


# ---------- category suggestion ----------
# started as just keyword matching, then added a real API call on top of it.
# kept the keyword version as the fallback since I didn't want a bad/missing
# API key to break the demo

KEYWORD_MAP = {
    "Plumbing": ["leak", "sink", "toilet", "faucet", "pipe", "water", "drain", "clog"],
    "Electrical": ["outlet", "light", "power", "breaker", "wiring", "switch", "electric"],
    "HVAC": ["heat", "air conditioning", "ac ", "furnace", "thermostat", "vent", "hvac"],
}


def rule_based_category(description: str) -> str:
    text = description.lower()
    for category, keywords in KEYWORD_MAP.items():
        if any(k in text for k in keywords):
            return category
    return "Other"


@app.post("/requests/suggest-category", response_model=CategorySuggestResponse)
def suggest_category(payload: CategorySuggestRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:
        return CategorySuggestResponse(
            suggested_category=rule_based_category(payload.description),
            source="rules",
        )

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-3-5-haiku-latest",
            max_tokens=10,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Classify this maintenance request into exactly one word: "
                        "Plumbing, Electrical, HVAC, or Other. "
                        f"Request: {payload.description}\n"
                        "Answer with only the single category word."
                    ),
                }
            ],
        )
        text = message.content[0].text.strip()
        category = text if text in ("Plumbing", "Electrical", "HVAC", "Other") else rule_based_category(payload.description)
        return CategorySuggestResponse(suggested_category=category, source="ai")
    except Exception:
        return CategorySuggestResponse(
            suggested_category=rule_based_category(payload.description),
            source="rules",
        )
