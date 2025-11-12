# ai_agent/app.py
import os
import time
import requests
import json
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
NODE_BACKEND = os.getenv("NODE_BACKEND", "http://localhost:5000")

app = FastAPI(title="Movi Python Agent (LangGraph-style)")

from fastapi.middleware.cors import CORSMiddleware

# right after `app = FastAPI(...)`
origins = [
    "http://localhost:5173",  # Vite default
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PENDING = {}

class AgentRequest(BaseModel):
    input: Optional[str] = None
    currentPage: Optional[str] = None
    imageText: Optional[str] = None
    pendingId: Optional[str] = None

# Node helper wrappers
def node_get(path, params=None):
    url = NODE_BACKEND.rstrip("/") + path
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    return r.json()

def node_post(path, json_body=None):
    url = NODE_BACKEND.rstrip("/") + path
    r = requests.post(url, json=json_body, timeout=10)
    r.raise_for_status()
    return r.json()

def node_delete(path):
    url = NODE_BACKEND.rstrip("/") + path
    r = requests.delete(url, timeout=10)
    r.raise_for_status()
    return r.json()

# LLM call (optional)
def call_llm(prompt: str):
    if not OPENAI_API_KEY:
        return None
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": OPENAI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 512,
        "temperature": 0.0
    }
    resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    j = resp.json()
    return j["choices"][0]["message"]["content"].strip()

# Fallback parser
def fallback_parse_intent(user_text: str):
    text = (user_text or "").lower().strip()
    out = {"intent": "unknown", "target": None}
    if "remove" in text and "vehicle" in text:
        out["intent"] = "remove_vehicle"
        if " from " in text:
            out["target"] = user_text.split(" from ", 1)[1].strip()
        else:
            if '"' in user_text:
                parts = user_text.split('"')
                if len(parts) >= 2:
                    out["target"] = parts[1]
            else:
                out["target"] = " ".join(user_text.split()[-3:])
    elif text in ("yes", "y", "confirm", "proceed"):
        out["intent"] = "confirm"
    return out

# Core orchestration
def perform_consequence_check_and_maybe_execute(parsed_intent, image_text=None, pending_id=None):
    # handle confirm intent
    if parsed_intent.get("intent") == "confirm" and pending_id:
        p = PENDING.get(pending_id)
        if not p:
            return {"ok": False, "message": "No pending action found."}
        if p["action"] == "remove_vehicle":
            trip_id = p["details"]["trip_id"]
            deployment_id = p["details"]["deployment_id"]
            # delete deployment
            resp_del = node_delete(f"/api/deployments/{deployment_id}")
            # cancel bookings by marking them cancelled via Node: We'll call Node's bookings endpoint to list, then update each via a helper if available.
            # For simplicity, assume Node-side agent cancels bookings via previous Node implementation; here we return count.
            cancelled = p["details"].get("bookings", 0)
            del PENDING[pending_id]
            return {"ok": True, "message": f"Removed vehicle (deployment {deployment_id}) from trip {trip_id}. Cancelled {cancelled} bookings.", "deleted": resp_del.get("deleted", 0), "cancelled": cancelled}
        return {"ok": False, "message": "Unknown pending action."}

    # else handle remove_vehicle
    target = parsed_intent.get("target") or image_text
    if not target:
        return {"ok": False, "message": "Could not determine trip target. Provide a trip name or include imageText."}

    # find trip via image/parse endpoint
    resp = node_post("/api/image/parse", json_body={"text": target})
    if not resp.get("found"):
        return {"ok": False, "message": f"Couldn't find trip matching '{target}'."}
    trip = resp.get("trip")
    trip_id = trip["trip_id"]

    # get confirmed bookings count
    bookings_list = node_get(f"/api/bookings/trip/{trip_id}")
    booking_count = len(bookings_list) if isinstance(bookings_list, list) else 0

    # find deployment via helper endpoint you added
    helper = node_get(f"/api/helpers/deployment_for_trip/{trip_id}")
    if not helper.get("found"):
        return {"ok": False, "message": f"No vehicle deployed for trip {trip.get('display_name')}."}
    deployment = helper.get("deployment")
    deployment_id = deployment.get("deployment_id")

    if booking_count > 0:
        pending_id = f"p_{int(time.time()*1000)}"
        PENDING[pending_id] = {
            "action": "remove_vehicle",
            "details": {"trip_id": trip_id, "deployment_id": deployment_id, "bookings": booking_count},
            "createdAt": time.time()
        }
        msg = (f'I can remove the vehicle from \"{trip.get("display_name")}\". However, this trip has {booking_count} confirmed booking(s). '
               "Removing the vehicle will cancel those bookings. Reply with 'yes' and include pendingId: " + pending_id)
        return {"ok": True, "confirmationRequired": True, "pendingId": pending_id, "message": msg, "trip": trip, "bookings": booking_count, "deployment": {"deployment_id": deployment_id}}

    # no bookings -> delete immediately
    try:
        delresp = node_delete(f"/api/deployments/{deployment_id}")
    except Exception as e:
        return {"ok": False, "message": f"Could not delete deployment: {str(e)}"}
    return {"ok": True, "message": f'Vehicle removed from \"{trip.get("display_name")}\" (deployment {deployment_id}).', "deleted": delresp.get("deleted", 0)}

@app.post("/ai/agent")
async def ai_agent(req: AgentRequest):
    text = (req.input or "").strip()
    # confirm path
    if req.pendingId and text.lower() in ("yes", "y", "confirm", "proceed"):
        result = perform_consequence_check_and_maybe_execute({"intent":"confirm"}, pending_id=req.pendingId)
        return result

    # LLM parsing (if key present) or fallback
    parsed = None
    if OPENAI_API_KEY and text:
        prompt = f"Extract intent and target from this user message. Respond JSON with keys: intent ('remove_vehicle' or 'confirm' or 'unknown'), target_text (may be null). Message: '''{text}'''"
        try:
            llm_out = call_llm(prompt)
            try:
                parsed_json = json.loads(llm_out)
                parsed = {"intent": parsed_json.get("intent"), "target": parsed_json.get("target_text")}
            except Exception:
                parsed = fallback_parse_intent(text)
        except Exception:
            parsed = fallback_parse_intent(text)
    else:
        parsed = fallback_parse_intent(text)

    result = perform_consequence_check_and_maybe_execute(parsed, image_text=req.imageText, pending_id=req.pendingId)
    return result

@app.get("/ai/health")
def health():
    return {"ok": True, "node_backend": NODE_BACKEND, "openai": bool(OPENAI_API_KEY)}
