import os
import time, random
import requests
import json
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
NODE_BACKEND = os.getenv("NODE_BACKEND", "http://localhost:5000")

app = FastAPI(title="Movi Python Agent (LangGraph-style)")

from fastapi.middleware.cors import CORSMiddleware


origins = [
    "http://localhost:5173", 
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

# LLM 
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

    # greetings
    if text in ("hi", "hello", "hey", "hey movi", "hi movi"):
        out["intent"] = "greeting"
        return out

    # confirmations
    if text in ("yes", "y", "confirm", "proceed", "ok", "sure"):
        out["intent"] = "confirm"
        return out

    # remove / delete intents (vehicle or trip operations)
    remove_keywords = ("remove", "delete", "unassign", "cancel", "deassign")
    if any(w in text for w in remove_keywords) and ("vehicle" in text or "trip" in text or "deployment" in text):
        out["intent"] = "remove_vehicle"
        # attempt to find target
        if " from " in text:
            out["target"] = user_text.split(" from ", 1)[1].strip()
        elif '"' in user_text:
            parts = user_text.split('"')
            if len(parts) >= 2:
                out["target"] = parts[1]
        else:
            parts = user_text.split()
            out["target"] = " ".join(parts[-4:])  
        return out

    # small heuristics for read queries
    if text.startswith("how many") or text.startswith("what") or "status" in text or "list" in text or "show" in text:
        out["intent"] = "query"
        out["target"] = user_text
        return out

    # single-word ambiguous commands
    if text in ("delete", "remove", "cancel"):
        out["intent"] = "remove_vehicle"
        out["target"] = None
        return out

    return out


# Core orchestration
def perform_consequence_check_and_maybe_execute(parsed_intent, image_text=None, pending_id=None, current_page=None):
    """
    Robust handler for consequence checking and execution (remove vehicle flows).
    Returns consistent JSON objects expected by the frontend.
    """
    logger.info(
        "perform_consequence_check_and_maybe_execute called: parsed=%s image_text=%s pending_id=%s page=%s",
        parsed_intent, image_text, pending_id, current_page
    )

    # 1) Confirmation handling
    if parsed_intent and parsed_intent.get("intent") == "confirm" and pending_id:
        logger.info("Handling confirm for pending_id=%s", pending_id)
        p = PENDING.get(pending_id)
        if not p:
            logger.info("Pending id not found: %s", pending_id)
            return {"ok": False, "message": "No pending action found."}

        if p["action"] == "remove_vehicle":
            trip_id = p["details"]["trip_id"]
            deployment_id = p["details"]["deployment_id"]
            try:
                resp_del = node_delete(f"/api/deployments/{deployment_id}") or {}
                cancelled = p["details"].get("bookings", 0)
                del PENDING[pending_id]
                msg = f"Removed vehicle (deployment {deployment_id}) from trip {trip_id}. Cancelled {cancelled} bookings."
                logger.info("Confirm executed: %s", msg)
                return {"ok": True, "message": msg, "deleted": resp_del.get("deleted", 0), "cancelled": cancelled}
            except Exception as e:
                logger.exception("Error executing confirm for pending: %s", e)
                return {"ok": False, "message": f"Failed to execute pending action: {str(e)}"}
        else:
            logger.warning("Unknown pending action type: %s", p.get("action"))
            return {"ok": False, "message": "Unknown pending action."}

    # 2) Remove vehicle intent handling
    if parsed_intent and parsed_intent.get("intent") == "remove_vehicle":
        target_text = parsed_intent.get("target") or image_text
        if target_text:
            target_text = target_text.strip()
            logger.info("Attempting to resolve target trip from text: %s", target_text)
        else:
            logger.info("No target provided for remove_vehicle.")
            return {"ok": False, "message": "I understood you want to remove a vehicle, but I couldn't determine which trip. Please provide the trip name (e.g., 'Bulk - 00:01') or click a trip in the UI."}

        # Try Node backend trips endpoint
        try:
            trips_resp = node_get("/api/daily_trips")
            trips = trips_resp if isinstance(trips_resp, list) else trips_resp.get("trips", [])
            logger.info("Fetched %d trips from Node to search for match.", len(trips))
        except Exception as e:
            logger.exception("Failed to fetch trips from Node: %s", e)
            return {"ok": False, "message": "Unable to search trips right now (backend error)."}

        # naive case-insensitive match
        match = None
        t_low = target_text.lower()
        for t in trips:
            name = (t.get("display_name") or t.get("name") or "").lower()
            if not name:
                continue
            if t_low in name or name in t_low:
                match = t
                break

        if not match:
            logger.info("No trip matched target_text='%s'", target_text)
            return {"ok": False, "message": f"I couldn't find a trip matching '{target_text}'. Please provide an exact trip name (e.g., 'Bulk - 00:01') or use the UI to select a trip."}

        trip_id = match.get("trip_id") or match.get("id") or match.get("tripId")
        display_name = match.get("display_name") or match.get("name") or target_text
        logger.info("Resolved trip to id=%s display_name=%s", trip_id, display_name)

        # find deployment for the trip
        try:
            dep = node_get(f"/api/helpers/deployment_for_trip/{trip_id}")
            deployment = dep.get("deployment") if isinstance(dep, dict) else dep
            if not deployment:
                logger.info("No deployment found for trip %s", trip_id)
                return {"ok": False, "message": f"No vehicle is currently deployed on trip '{display_name}'."}
        except Exception as e:
            logger.exception("Error fetching deployment for trip %s: %s", trip_id, e)
            return {"ok": False, "message": "Error checking current deployment (backend error)."}

        deployment_id = deployment.get("deployment_id") or deployment.get("id") or deployment.get("deploymentId")
        vehicle_id = deployment.get("vehicle_id")
        driver_id = deployment.get("driver_id")

        # get bookings count (helper)
        bookings_count = 0
        try:
            b = node_get(f"/api/helpers/bookings_for_trip/{trip_id}")
            # support helper returning {"count": N} or list
            if isinstance(b, dict):
                bookings_count = int(b.get("count", 0))
            elif isinstance(b, list):
                bookings_count = len(b)
            else:
                bookings_count = int(b or 0)
        except Exception:
            logger.info("Could not fetch booking count for trip %s; defaulting to 0", trip_id)

        # if bookings exist -> create pending confirmation
        if bookings_count and bookings_count > 0:
            pid = f"p_{int(time.time()*1000)}_{random.randint(100,999)}"
            PENDING[pid] = {
                "action": "remove_vehicle",
                "details": {
                    "trip_id": trip_id,
                    "display_name": display_name,
                    "deployment_id": deployment_id,
                    "vehicle_id": vehicle_id,
                    "driver_id": driver_id,
                    "bookings": bookings_count,
                    "requested_by_page": current_page,
                },
                "createdAt": time.time()
            }
            logger.info("Created pending %s for remove_vehicle on trip %s (bookings=%s)", pid, trip_id, bookings_count)
            return {
                "ok": True,
                "confirmationRequired": True,
                "pendingId": pid,
                "message": f"I can remove the vehicle from \"{display_name}\". However, this trip has {bookings_count} confirmed booking(s). Removing the vehicle will cancel those bookings. Do you want to proceed? Reply with \"yes\" and include pendingId: {pid}",
                "trip": {"trip_id": trip_id, "display_name": display_name},
                "bookings": bookings_count,
                "deployment": {"deployment_id": deployment_id, "vehicle_id": vehicle_id, "driver_id": driver_id}
            }

        # no bookings -> delete immediately
        try:
            logger.info("No bookings on trip %s — removing deployment %s immediately.", trip_id, deployment_id)
            resp_del = node_delete(f"/api/deployments/{deployment_id}") or {}
            msg = f"Removed vehicle (deployment {deployment_id}) from trip {trip_id}. Cancelled 0 bookings."
            logger.info("Immediate removal executed for deployment %s", deployment_id)
            return {"ok": True, "message": msg, "deleted": resp_del.get("deleted", 0), "cancelled": 0}
        except Exception as e:
            logger.exception("Failed to remove deployment %s: %s", deployment_id, e)
            return {"ok": False, "message": "Failed to remove vehicle due to a backend error."}

    # 3) greetings / queries / fallback
    if parsed_intent and parsed_intent.get("intent") == "greeting":
        return {"ok": True, "message": "Hi — I'm Movi. I can help manage trips and vehicles. Try: 'Remove the vehicle from Bulk - 00:01'."}

    if parsed_intent and parsed_intent.get("intent") == "query":
        return {"ok": True, "message": f"I understood your query: '{parsed_intent.get('target')}'. I can help fetch details — try specifying what you want (e.g., 'list bookings for Bulk - 00:01')."}

    logger.info("Could not map parsed intent to an action: %s", parsed_intent)
    return {"ok": False, "message": "Sorry — I could not process that. Please rephrase or provide more details (trip name, or click a trip in the UI)."}

@app.post("/ai/agent")
async def ai_agent(req: AgentRequest):
    logger.info("Received AI request: %s", req.dict())
    text = (req.input or "").strip()

    # Greeting quick path
    if text.lower() in ("hi", "hello", "hey", "hey movi"):
        return {"ok": True, "message": "Hi — I'm Movi. I can help manage trips and vehicles. Try: 'Remove the vehicle from Bulk - 00:01'."}

    # confirmation path
    if req.pendingId and text.lower() in ("yes", "y", "confirm", "proceed"):
        logger.info("Processing confirmation for pendingId=%s", req.pendingId)
        result = perform_consequence_check_and_maybe_execute({"intent":"confirm"}, pending_id=req.pendingId)
        logger.info("Confirmation result: %s", result)
        return result

    # parse intent (LLM optional)
    parsed = None
    if OPENAI_API_KEY and text:
        try:
            prompt = f"Extract intent and target from this user message. Respond JSON with keys: intent ('remove_vehicle','confirm','greeting','query','unknown'), target_text (or null). Message: '''{text}'''"
            llm_out = call_llm(prompt)
            parsed_json = json.loads(llm_out) if llm_out else {}
            parsed = {"intent": parsed_json.get("intent"), "target": parsed_json.get("target_text")}
        except Exception as e:
            logger.warning("LLM parse failed: %s - falling back", e)
            parsed = fallback_parse_intent(text)
    else:
        parsed = fallback_parse_intent(text)

    logger.info("Parsed intent: %s", parsed)

    result = perform_consequence_check_and_maybe_execute(parsed, image_text=req.imageText, pending_id=req.pendingId, current_page=req.currentPage)
    logger.info("Action result: %s", result)
    return result


@app.get("/ai/health")
def health():
    return {"ok": True, "node_backend": NODE_BACKEND, "openai": bool(OPENAI_API_KEY)}
