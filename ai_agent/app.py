import os
import time
import random
import json
import logging
import difflib
from typing import Optional, Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import requests
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
NODE_BACKEND = os.getenv("NODE_BACKEND", "http://localhost:5000")

app = FastAPI(title="Movi Python Agent")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PENDING: Dict[str, Dict[str, Any]] = {}


class AgentRequest(BaseModel):
    input: Optional[str] = None
    currentPage: Optional[str] = None
    imageText: Optional[str] = None
    pendingId: Optional[str] = None


# --------------------------
# Node helper wrappers
# --------------------------


def node_get(path: str, params: Optional[dict] = None):
    url = NODE_BACKEND.rstrip("/") + path
    logger.info("GET %s params=%s", url, params)
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        logger.warning("Non-JSON response from %s", url)
        return None


def node_post(path: str, json_body: Optional[dict] = None):
    url = NODE_BACKEND.rstrip("/") + path
    logger.info("POST %s body=%s", url, json_body)
    r = requests.post(url, json=json_body, timeout=10)
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        logger.warning("Non-JSON response from %s", url)
        return None


def node_delete(path: str):
    url = NODE_BACKEND.rstrip("/") + path
    logger.info("DELETE %s", url)
    r = requests.delete(url, timeout=10)
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        logger.warning("Non-JSON response from %s", url)
        return None


# --------------------------
# LLM wrapper
# --------------------------


def call_llm(prompt: str):
    if not OPENAI_API_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENAI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 512,
        "temperature": 0.0,
    }

    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    j = resp.json()
    return j["choices"][0]["message"]["content"].strip()


# --------------------------
# Matching helpers
# --------------------------


def _normalize_name(s: str) -> str:
    """Lowercase and collapse whitespace for more robust matching."""
    return " ".join((s or "").lower().split())


def fetch_daily_trips():
    """Fetch today's trips from the Node backend."""
    resp = node_get("/api/daily_trips")
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict):
        for key in ("trips", "data", "items"):
            val = resp.get(key)
            if isinstance(val, list):
                return val
    logger.warning("Unexpected /api/daily_trips payload shape: %s", type(resp))
    return []


def find_best_trip_match(target_text: str, trips: list):
    """Best-effort trip match using display_name with fuzzy logic."""
    if not target_text or not trips:
        return None

    target_norm = _normalize_name(target_text)
    if not target_norm:
        return None

    candidates: Dict[str, Any] = {}
    for t in trips:
        name = t.get("display_name") or t.get("name") or t.get("trip_name") or ""
        n = _normalize_name(name)
        if not n:
            continue
        candidates[n] = t

    if not candidates:
        return None

    # exact normalized name
    if target_norm in candidates:
        return candidates[target_norm]

    # substring match
    for n, trip in candidates.items():
        if target_norm in n or n in target_norm:
            return trip

    # fuzzy match on normalized names
    names = list(candidates.keys())
    close = difflib.get_close_matches(target_norm, names, n=1, cutoff=0.6)
    if close:
        return candidates[close[0]]
    return None


def fetch_routes():
    """Fetch routes from the Node backend."""
    resp = node_get("/api/routes")
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict):
        for key in ("routes", "data", "items"):
            val = resp.get(key)
            if isinstance(val, list):
                return val
    logger.warning("Unexpected /api/routes payload shape: %s", type(resp))
    return []


def find_best_route_match(target_text: str, routes: list):
    """Best-effort route match based on name or id."""
    if not target_text or not routes:
        return None

    target_norm = _normalize_name(target_text)
    if not target_norm:
        return None

    candidates: Dict[str, Any] = {}
    for r in routes:
        name = (
            r.get("route_display_name")
            or r.get("display_name")
            or r.get("name")
            or ""
        )
        n = _normalize_name(name)
        if n:
            candidates[n] = r

        rid = r.get("route_id") or r.get("id") or r.get("routeId")
        if rid is not None:
            candidates[str(rid)] = r

    if not candidates:
        return None

    # direct id or exact name match
    if target_norm in candidates:
        return candidates[target_norm]

    # substring match
    for n, route in candidates.items():
        if target_norm in n or n in target_norm:
            return route

    # fuzzy match
    keys = list(candidates.keys())
    close = difflib.get_close_matches(target_norm, keys, n=1, cutoff=0.6)
    if close:
        return candidates[close[0]]
    return None


def fetch_deployments():
    """Fetch all deployments (used for list_unassigned_trips)."""
    resp = node_get("/api/deployments")
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict):
        for key in ("deployments", "data", "items"):
            val = resp.get(key)
            if isinstance(val, list):
                return val
    logger.warning("Unexpected /api/deployments payload shape: %s", type(resp))
    return []


# --------------------------
# Intent parsing helpers
# --------------------------


def _looks_like_trip_or_route_name(text: str) -> bool:
    t = text.strip()
    # very simple heuristic: contains a time or a dash pattern
    if re.search(r"\d{1,2}:\d{2}", t):
        return True
    if "-" in t:
        return True
    return False


def _strip_status_wrappers(text: str) -> str:
    """Remove 'status of', 'what is the status of', etc. from the front."""
    t = (text or "").strip()
    tl = t.lower()

    patterns = [
        r"^(what\s+is\s+the\s+status\s+of\s+)",
        r"^(what\s+is\s+status\s+of\s+)",
        r"^(status\s+of\s+)",
        r"^(status\s+for\s+)",
        r"^(status\s+)",
    ]

    for pat in patterns:
        m = re.match(pat, tl)
        if m:
            # cut off exactly the matched prefix length from original string
            return t[m.end():].strip()
    return t


def _extract_trip_phrase_from_text(text: str) -> Optional[str]:
    """
    Try to pull out the trip phrase for assignment/tripsheet, e.g.
    'Assign vehicle 2 to Bulk - 00:01' -> 'Bulk - 00:01'
    """
    if not text:
        return None
    # quoted
    if '"' in text:
        parts = text.split('"')
        if len(parts) >= 3:
            return parts[1].strip()

    # after 'to' or 'for'
    m = re.search(r"\bto\s+(.+)$", text, flags=re.IGNORECASE)
    if not m:
        m = re.search(r"\bfor\s+(.+)$", text, flags=re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # fallback: last few words
    parts = text.split()
    if len(parts) >= 3:
        return " ".join(parts[-4:]).strip()
    return text.strip()


def _extract_vehicle_and_driver(text: str):
    """
    Extract vehicle_id and driver_id integers from text if present.
    Returns (vehicle_id_or_None, driver_id_or_None).
    """
    if not text:
        return None, None
    v_match = re.search(r"\bvehicle\s+(\d+)\b", text, flags=re.IGNORECASE)
    if not v_match:
        v_match = re.search(r"\bbus\s+(\d+)\b", text, flags=re.IGNORECASE)
    d_match = re.search(r"\bdriver\s+(\d+)\b", text, flags=re.IGNORECASE)

    vehicle_id = int(v_match.group(1)) if v_match else None
    driver_id = int(d_match.group(1)) if d_match else None
    return vehicle_id, driver_id


def fallback_parse_intent(user_text: str):
    text = (user_text or "").lower().strip()
    out = {"intent": "unknown", "target": None}

    if not text:
        return out

    # greetings
    if text in ("hi", "hello", "hey", "hey movi", "hi movi"):
        out["intent"] = "greeting"
        return out

    # confirmations
    if text in ("yes", "y", "confirm", "proceed", "ok", "okay", "sure"):
        out["intent"] = "confirm"
        return out

    # remove / delete intents (vehicle or trip operations)
    remove_keywords = ("remove", "delete", "unassign", "cancel", "deassign")
    if any(w in text for w in remove_keywords) and any(
        k in text for k in ("vehicle", "trip", "deployment", "bus")
    ):
        out["intent"] = "remove_vehicle"
        # attempt to find target phrase
        if " from " in user_text:
            out["target"] = user_text.split(" from ", 1)[1].strip()
        elif '"' in user_text:
            parts = user_text.split('"')
            if len(parts) >= 2:
                out["target"] = parts[1]
        else:
            parts = user_text.split()
            out["target"] = " ".join(parts[-4:])
        return out

    # assign vehicle intent
    assign_keywords = ("assign", "allocate", "deploy")
    if any(w in text for w in assign_keywords) and any(
        k in text for k in ("vehicle", "bus")
    ):
        out["intent"] = "assign_vehicle"
        out["target"] = _extract_trip_phrase_from_text(user_text)
        return out

    # tripsheet / summary
    if "tripsheet" in text or "trip sheet" in text or "trip summary" in text or (
        "summary" in text and "trip" in text
    ):
        out["intent"] = "tripsheet"
        out["target"] = _extract_trip_phrase_from_text(user_text)
        return out

    # list trips
    if (
        (("show" in text) or ("list" in text)) and ("trip" in text or "trips" in text)
    ) or text in ("show trips", "list trips", "show all trips", "list all trips"):
        out["intent"] = "list_trips"
        out["target"] = user_text
        return out

    # list routes
    if (
        (("show" in text) or ("list" in text)) and ("route" in text or "routes" in text)
    ) or text in ("show routes", "list routes", "show all routes", "list all routes"):
        out["intent"] = "list_routes"
        out["target"] = user_text
        return out

    # list unassigned trips
    if (
        "no vehicle" in text
        or "without vehicle" in text
        or "without bus" in text
        or "unassigned" in text
    ) and ("trip" in text or "trips" in text or "bus" in text or "buses" in text):
        out["intent"] = "list_unassigned_trips"
        out["target"] = user_text
        return out

    # route-related queries
    route_keywords = ("route", "routes", "line", "corridor", "path")
    query_keywords = (
        "what",
        "show",
        "list",
        "which",
        "status",
        "running",
        "runs",
        "from",
        "to",
    )
    if any(k in text for k in route_keywords) and any(
        q in text for q in query_keywords
    ):
        out["intent"] = "route_query"
        out["target"] = user_text
        return out

    # trip-related queries (status of a bus/trip)
    trip_keywords = (
        "trip",
        "trips",
        "service",
        "bus",
        "deployment",
        "booking",
        "bookings",
    )
    # treat "status of X" / "trip status" / "bus status" as trip queries even
    # if the word "trip" is not explicitly present
    if (
        any(k in text for k in trip_keywords)
        or "status of" in text
        or "trip status" in text
        or "bus status" in text
    ) and any(q in text for q in query_keywords):
        out["intent"] = "trip_query"
        out["target"] = user_text
        return out

    # generic query fallback
    if (
        text.startswith("how many")
        or text.startswith("what")
        or "status" in text
        or "list" in text
        or "show" in text
    ):
        out["intent"] = "query"
        out["target"] = user_text
        return out

    # single-word ambiguous commands
    if text in ("delete", "remove", "cancel"):
        out["intent"] = "remove_vehicle"
        out["target"] = None
        return out

    return out


# --------------------------
# Core orchestration
# --------------------------


def perform_consequence_check_and_maybe_execute(
    parsed_intent,
    image_text: Optional[str] = None,
    pending_id: Optional[str] = None,
    current_page: Optional[str] = None,
):
    """
    Handles consequence checking and execution:
    - remove vehicle
    - assign vehicle
    - trip/route info
    - list_* flows
    - tripsheet
    Returns consistent JSON objects expected by the frontend.
    """
    logger.info(
        "perform_consequence_check_and_maybe_execute called: parsed=%s image_text=%s pending_id=%s page=%s",
        parsed_intent,
        image_text,
        pending_id,
        current_page,
    )

    intent = parsed_intent.get("intent") if parsed_intent else None
    raw_text = parsed_intent.get("raw_text") if parsed_intent else None

    # 1) Confirmation handling
    if intent == "confirm" and pending_id:
        logger.info("Handling confirm for pending_id=%s", pending_id)
        p = PENDING.get(pending_id)
        if not p:
            logger.info("Pending id not found: %s", pending_id)
            return {"ok": False, "message": "No pending action found."}

        if p["action"] == "remove_vehicle":
            trip_id = p["details"]["trip_id"]
            deployment_id = p["details"]["deployment_id"]
            bookings_count = p["details"].get("bookings", 0)
            try:
                resp_del = node_delete(f"/api/deployments/{deployment_id}") or {}
                # NOTE: bookings are conceptually cancelled in DB by backend logic.
                del PENDING[pending_id]
                msg = (
                    f"Removed vehicle (deployment {deployment_id}) from trip {trip_id}. "
                    f"Cancelled {bookings_count} bookings."
                )
                logger.info("Confirm executed: %s", msg)
                return {
                    "ok": True,
                    "message": msg,
                    "deleted": resp_del.get("changed", resp_del.get("deleted", 0)),
                    "cancelled": bookings_count,
                }
            except Exception as e:
                logger.exception("Error executing confirm for pending: %s", e)
                return {
                    "ok": False,
                    "message": f"Failed to execute pending action: {str(e)}",
                }
        else:
            logger.warning("Unknown pending action type: %s", p.get("action"))
            return {"ok": False, "message": "Unknown pending action."}

    # 2) Remove vehicle intent handling
    if intent == "remove_vehicle":
        target_text = parsed_intent.get("target") or image_text
        if target_text:
            target_text = target_text.strip()
            logger.info("Attempting to resolve target trip from text: %s", target_text)
        else:
            logger.info("No target provided for remove_vehicle.")
            return {
                "ok": False,
                "message": (
                    "I understood you want to remove a vehicle, "
                    "but I couldn't see which trip. Please specify the trip name (e.g., 'Bulk - 00:01') "
                    "or click a trip in the UI."
                ),
            }

        try:
            trips = fetch_daily_trips()
            logger.info("Fetched %d trips from Node to search for match.", len(trips))
        except Exception as e:
            logger.exception("Failed to fetch trips from Node: %s", e)
            return {
                "ok": False,
                "message": "Unable to search trips right now (backend error).",
            }

        match = find_best_trip_match(target_text, trips)

        if not match:
            logger.info("No trip matched target_text='%s'", target_text)
            return {
                "ok": False,
                "message": (
                    f"I couldn't find a trip matching '{target_text}'. "
                    "Please provide an exact trip name (e.g., 'Bulk - 00:01') or use the UI to select a trip."
                ),
            }

        trip_id = match.get("trip_id") or match.get("id") or match.get("tripId")
        display_name = match.get("display_name") or match.get("name") or target_text
        logger.info("Resolved trip to id=%s display_name=%s", trip_id, display_name)

        # find deployment for the trip
        try:
            dep = node_get(f"/api/helpers/deployment_for_trip/{trip_id}")
            deployment = None
            if isinstance(dep, dict):
                if dep.get("found") and dep.get("deployment"):
                    deployment = dep["deployment"]
                elif dep.get("deployment"):
                    deployment = dep["deployment"]
            else:
                deployment = dep

            if not deployment:
                logger.info("No deployment found for trip %s", trip_id)
                return {
                    "ok": False,
                    "message": f"No vehicle is currently deployed on trip '{display_name}'.",
                }
        except Exception as e:
            logger.exception("Error fetching deployment for trip %s: %s", trip_id, e)
            return {
                "ok": False,
                "message": "Error checking current deployment (backend error).",
            }

        deployment_id = (
            deployment.get("deployment_id")
            or deployment.get("id")
            or deployment.get("deploymentId")
        )
        vehicle_id = deployment.get("vehicle_id")
        driver_id = deployment.get("driver_id")

        # get bookings count
        bookings_count = 0
        try:
            b = node_get(f"/api/bookings/trip/{trip_id}")
            if isinstance(b, list):
                bookings_count = len(b)
            elif isinstance(b, dict):
                bookings_count = int(b.get("count", 0))
            else:
                bookings_count = int(b or 0)
        except Exception:
            logger.info(
                "Could not fetch booking count for trip %s; defaulting to 0",
                trip_id,
            )

        # if bookings exist -> create pending confirmation
        if bookings_count and bookings_count > 0:
            pid = f"p_{int(time.time() * 1000)}_{random.randint(100, 999)}"
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
                "createdAt": time.time(),
            }
            logger.info(
                "Created pending %s for remove_vehicle on trip %s (bookings=%s)",
                pid,
                trip_id,
                bookings_count,
            )
            return {
                "ok": True,
                "confirmationRequired": True,
                "pendingId": pid,
                "message": (
                    f"Trip '{display_name}' has {bookings_count} active booking(s). "
                    f"Removing the vehicle will cancel these bookings. "
                    f"Do you want to proceed? Reply with 'yes' using pendingId: {pid}."
                ),
                "trip": {"trip_id": trip_id, "display_name": display_name},
                "bookings": bookings_count,
                "deployment": {
                    "deployment_id": deployment_id,
                    "vehicle_id": vehicle_id,
                    "driver_id": driver_id,
                },
            }

        # no bookings -> delete immediately
        try:
            logger.info(
                "No bookings on trip %s — removing deployment %s immediately.",
                trip_id,
                deployment_id,
            )
            resp_del = node_delete(f"/api/deployments/{deployment_id}") or {}
            msg = (
                f"Removed vehicle (deployment {deployment_id}) from trip {trip_id}. "
                "Cancelled 0 bookings."
            )
            logger.info("Immediate removal executed for deployment %s", deployment_id)
            return {
                "ok": True,
                "message": msg,
                "deleted": resp_del.get("changed", resp_del.get("deleted", 0)),
                "cancelled": 0,
            }
        except Exception as e:
            logger.exception("Failed to remove deployment %s: %s", deployment_id, e)
            return {
                "ok": False,
                "message": "Failed to remove vehicle due to a backend error.",
            }

    # 3) Trip info queries
    if intent == "trip_query":
        target_text = parsed_intent.get("target") or image_text
        if target_text:
            target_text = _strip_status_wrappers(target_text).strip()
            logger.info("Trip query on text: %s", target_text)

        try:
            trips = fetch_daily_trips()
            logger.info("Fetched %d trips for trip_query.", len(trips))
        except Exception as e:
            logger.exception("Failed to fetch trips from Node: %s", e)
            return {
                "ok": False,
                "message": "I couldn't load today's trips from the backend.",
            }

        if not trips:
            return {
                "ok": False,
                "message": "There are no trips in the system for today.",
            }

        target_norm = _normalize_name(target_text) if target_text else ""
        generic_trip_targets = {
            "",
            "trip",
            "trips",
            "show trips",
            "show me trips",
            "show all trips",
            "list trips",
            "list all trips",
        }

        # Generic "show trips" style query
        if not target_text or target_norm in generic_trip_targets:
            names = [
                t.get("display_name")
                or t.get("name")
                or f"trip {t.get('trip_id')}"
                for t in trips[:5]
            ]
            return {
                "ok": True,
                "message": "I see these trips for today: " + ", ".join(names),
            }

        # Try to match a specific trip
        match = find_best_trip_match(target_text, trips)
        if not match:
            return {
                "ok": False,
                "message": (
                    f"I couldn't find a trip matching '{target_text}'. "
                    "Try using the exact display name from the UI, like 'Bulk - 00:01'."
                ),
            }

        trip_id = match.get("trip_id") or match.get("id") or match.get("tripId")
        display_name = (
            match.get("display_name") or match.get("name") or f"Trip {trip_id}"
        )
        scheduled_date = match.get("scheduled_date") or match.get("date") or "today"

        # deployment info
        deployment = None
        try:
            dep = node_get(f"/api/helpers/deployment_for_trip/{trip_id}")
            if isinstance(dep, dict):
                if dep.get("found") and dep.get("deployment"):
                    deployment = dep["deployment"]
                elif dep.get("deployment"):
                    deployment = dep["deployment"]
            else:
                deployment = dep
        except Exception as e:
            logger.exception(
                "Error fetching deployment for trip %s: %s", trip_id, e
            )

        # booking count
        bookings_count = 0
        try:
            b = node_get(f"/api/bookings/trip/{trip_id}")
            if isinstance(b, list):
                bookings_count = len(b)
            elif isinstance(b, dict):
                bookings_count = int(b.get("count", 0))
            else:
                bookings_count = int(b or 0)
        except Exception:
            logger.info(
                "Could not fetch booking count for trip %s; defaulting to 0",
                trip_id,
            )

        if deployment:
            deployment_id = (
                deployment.get("deployment_id")
                or deployment.get("id")
                or deployment.get("deploymentId")
            )
            vehicle_id = deployment.get("vehicle_id")
            driver_id = deployment.get("driver_id")
            msg = (
                f"Trip '{display_name}' (id {trip_id}) on {scheduled_date} "
                f"has {bookings_count} booking(s) and a vehicle assigned "
                f"(deployment {deployment_id}, vehicle {vehicle_id}, driver {driver_id})."
            )
        else:
            msg = (
                f"Trip '{display_name}' (id {trip_id}) on {scheduled_date} "
                f"has {bookings_count} booking(s) and currently has no vehicle assigned."
            )

        return {
            "ok": True,
            "message": msg,
            "trip": {
                "trip_id": trip_id,
                "display_name": display_name,
                "scheduled_date": scheduled_date,
            },
            "bookings": bookings_count,
            "deployment": deployment,
        }

    # 4) Route info queries
    if intent == "route_query":
        target_text = parsed_intent.get("target") or image_text
        if target_text:
            target_text = _strip_status_wrappers(target_text).strip()
            logger.info("Route query on text: %s", target_text)

        routes = fetch_routes()
        if not routes:
            return {
                "ok": False,
                "message": "I couldn't load routes from the backend.",
            }

        target_norm = _normalize_name(target_text) if target_text else ""
        generic_route_targets = {
            "",
            "route",
            "routes",
            "show route",
            "show routes",
            "show me route",
            "show me routes",
            "show all routes",
            "list routes",
            "list all routes",
        }

        # Generic "show routes" style query
        if not target_text or target_norm in generic_route_targets:
            names = [
                r.get("route_display_name")
                or r.get("display_name")
                or f"route {r.get('route_id')}"
                for r in routes[:5]
            ]
            return {
                "ok": True,
                "message": "Here are some routes I know about: " + ", ".join(names),
            }

        # Otherwise, try to match a specific route
        match = find_best_route_match(target_text, routes)
        if not match:
            return {
                "ok": False,
                "message": (
                    f"I couldn't find a route matching '{target_text}'. "
                    "Try the exact route name or code from the UI."
                ),
            }

        route_id = match.get("route_id") or match.get("id") or match.get("routeId")
        route_name = (
            match.get("route_display_name")
            or match.get("display_name")
            or match.get("name")
            or f"Route {route_id}"
        )

        # Find today's trips on this route
        try:
            trips = fetch_daily_trips()
        except Exception as e:
            logger.exception("Failed to fetch trips for route_query: %s", e)
            trips = []

        def _trip_route_id(t):
            return str(t.get("route_id") or t.get("routeId") or "")

        route_id_str = str(route_id) if route_id is not None else ""
        trips_for_route = [t for t in trips if _trip_route_id(t) == route_id_str]

        trip_names = [
            t.get("display_name")
            or t.get("name")
            or f"trip {t.get('trip_id')}"
            for t in trips_for_route
        ]

        if trip_names:
            msg = (
                f"Route '{route_name}' (id {route_id}) has {len(trip_names)} trip(s) today: "
                + ", ".join(trip_names[:5])
            )
            if len(trip_names) > 5:
                msg += f", and {len(trip_names) - 5} more..."
        else:
            msg = (
                f"Route '{route_name}' (id {route_id}) currently has no daily trips scheduled."
            )

        return {
            "ok": True,
            "message": msg,
            "route": {"route_id": route_id, "route_name": route_name},
            "trips": trips_for_route,
        }

    # 5) ASSIGN VEHICLE
    if intent == "assign_vehicle":
        base_text = raw_text or ""
        target_text = parsed_intent.get("target") or image_text
        if not target_text and base_text:
            target_text = _extract_trip_phrase_from_text(base_text)
        if target_text:
            target_text = target_text.strip()
        logger.info("assign_vehicle target_text=%s raw_text=%s", target_text, base_text)

        if not target_text:
            return {
                "ok": False,
                "message": (
                    "I understood you want to assign a vehicle, but I couldn't see which trip. "
                    "Try: 'Assign vehicle 2 to Bulk - 00:01'."
                ),
            }

        try:
            trips = fetch_daily_trips()
        except Exception as e:
            logger.exception("Failed to fetch trips for assign_vehicle: %s", e)
            return {
                "ok": False,
                "message": "Unable to load trips right now (backend error).",
            }

        match = find_best_trip_match(target_text, trips)
        if not match:
            return {
                "ok": False,
                "message": (
                    f"I couldn't find a trip matching '{target_text}'. "
                    "Please use the exact trip name from the UI, e.g. 'Bulk - 00:01'."
                ),
            }

        trip_id = match.get("trip_id") or match.get("id") or match.get("tripId")
        display_name = (
            match.get("display_name") or match.get("name") or str(trip_id)
        )

        # Check if there is already a deployment
        try:
            dep = node_get(f"/api/helpers/deployment_for_trip/{trip_id}")
            deployment = None
            if isinstance(dep, dict):
                if dep.get("found") and dep.get("deployment"):
                    deployment = dep["deployment"]
                elif dep.get("deployment"):
                    deployment = dep["deployment"]
            else:
                deployment = dep
        except Exception as e:
            logger.exception("Failed to fetch deployment for assign_vehicle: %s", e)
            deployment = None

        if deployment:
            vehicle_id = deployment.get("vehicle_id")
            driver_id = deployment.get("driver_id")
            return {
                "ok": True,
                "message": (
                    f"Trip '{display_name}' (id {trip_id}) already has a vehicle deployed "
                    f"(vehicle {vehicle_id}, driver {driver_id}). "
                    "For now I won't replace it automatically. "
                    "If you want to change it, first remove the existing deployment and then assign again."
                ),
                "trip": {"trip_id": trip_id, "display_name": display_name},
                "deployment": deployment,
            }

        # No deployment yet -> figure out vehicle/driver from text
        vehicle_id, driver_id = _extract_vehicle_and_driver(base_text)

        if vehicle_id is None:
            # low-risk option: ask user which vehicle instead of guessing
            return {
                "ok": False,
                "message": (
                    f"Trip '{display_name}' (id {trip_id}) does not have any vehicle yet. "
                    "Tell me which vehicle ID to assign, for example: "
                    f"'Assign vehicle 1 to {display_name}'."
                ),
                "trip": {"trip_id": trip_id, "display_name": display_name},
            }

        body = {
            "trip_id": trip_id,
            "vehicle_id": vehicle_id,
            "driver_id": driver_id,
        }
        try:
            resp = node_post("/api/deployments", json_body=body) or {}
            deployment_id = resp.get("deployment_id") or resp.get("id")
        except Exception as e:
            logger.exception("Failed to create deployment: %s", e)
            return {
                "ok": False,
                "message": "Failed to assign vehicle due to a backend error.",
            }

        if driver_id is not None:
            msg = (
                f"Assigned vehicle {vehicle_id} and driver {driver_id} to trip "
                f"'{display_name}' (deployment {deployment_id})."
            )
        else:
            msg = (
                f"Assigned vehicle {vehicle_id} to trip '{display_name}' "
                f"(deployment {deployment_id}). No driver specified."
            )

        return {
            "ok": True,
            "message": msg,
            "trip": {"trip_id": trip_id, "display_name": display_name},
            "deployment": {
                "deployment_id": deployment_id,
                "vehicle_id": vehicle_id,
                "driver_id": driver_id,
            },
        }

    # 6) LIST TRIPS
    if intent == "list_trips":
        try:
            trips = fetch_daily_trips()
        except Exception as e:
            logger.exception("Failed to fetch trips for list_trips: %s", e)
            return {
                "ok": False,
                "message": "I couldn't load today's trips from the backend.",
            }

        if not trips:
            return {"ok": True, "message": "There are no trips scheduled for today."}

        names = [
            t.get("display_name")
            or t.get("name")
            or f"trip {t.get('trip_id')}"
            for t in trips
        ]
        prefix = f"Today I see {len(trips)} trip(s): "
        msg = prefix + ", ".join(names[:10])
        if len(names) > 10:
            msg += f", and {len(names) - 10} more."

        return {"ok": True, "message": msg, "trips": trips}

    # 7) LIST UNASSIGNED TRIPS
    if intent == "list_unassigned_trips":
        try:
            trips = fetch_daily_trips()
            deployments = fetch_deployments()
        except Exception as e:
            logger.exception("Backend error in list_unassigned_trips: %s", e)
            return {
                "ok": False,
                "message": "I couldn't load trips or deployments from the backend.",
            }

        if not trips:
            return {"ok": True, "message": "There are no trips scheduled today."}

        deployed_trip_ids = set()
        for d in deployments or []:
            tid = d.get("trip_id") or d.get("tripId")
            if tid is not None:
                deployed_trip_ids.add(int(tid))

        unassigned = []
        for t in trips:
            tid = t.get("trip_id") or t.get("id") or t.get("tripId")
            if tid is None:
                continue
            try:
                tid_int = int(tid)
            except Exception:
                continue
            if tid_int not in deployed_trip_ids:
                unassigned.append(t)

        if not unassigned:
            return {
                "ok": True,
                "message": "All trips currently have a vehicle assigned.",
                "trips": [],
            }

        names = [
            t.get("display_name")
            or t.get("name")
            or f"trip {t.get('trip_id')}"
            for t in unassigned
        ]
        msg = "Trips without a vehicle: " + ", ".join(names[:10])
        if len(names) > 10:
            msg += f", and {len(names) - 10} more."

        return {"ok": True, "message": msg, "trips": unassigned}

    # 8) LIST ROUTES
    if intent == "list_routes":
        try:
            routes = fetch_routes()
        except Exception as e:
            logger.exception("Failed to fetch routes for list_routes: %s", e)
            return {
                "ok": False,
                "message": "I couldn't load routes from the backend.",
            }

        if not routes:
            return {"ok": True, "message": "There are no routes configured."}

        descs = []
        for r in routes:
            route_id = r.get("route_id") or r.get("id") or r.get("routeId")
            name = (
                r.get("route_display_name")
                or r.get("display_name")
                or r.get("name")
                or f"Route {route_id}"
            )
            shift = r.get("shift_time") or r.get("time")
            direction = r.get("direction")
            parts = [name]
            extras = []
            if shift:
                extras.append(shift)
            if direction:
                extras.append(direction)
            if extras:
                parts.append(" - " + " ".join(extras))
            descs.append("".join(parts))

        msg = f"I see {len(routes)} route(s): " + ", ".join(descs[:10])
        if len(routes) > 10:
            msg += f", and {len(routes) - 10} more."

        return {"ok": True, "message": msg, "routes": routes}

    # 9) TRIPSHEET / TRIP SUMMARY
    if intent == "tripsheet":
        base_text = raw_text or ""
        target_text = parsed_intent.get("target") or image_text
        if not target_text and base_text:
            target_text = _extract_trip_phrase_from_text(base_text)
        if target_text:
            target_text = target_text.strip()
        logger.info("tripsheet target_text=%s raw_text=%s", target_text, base_text)

        if not target_text:
            return {
                "ok": False,
                "message": (
                    "I understood you want a tripsheet, but I couldn't see which trip. "
                    "Try: 'Generate tripsheet for Bulk - 00:01'."
                ),
            }

        try:
            trips = fetch_daily_trips()
        except Exception as e:
            logger.exception("Failed to fetch trips for tripsheet: %s", e)
            return {
                "ok": False,
                "message": "Unable to load trips right now (backend error).",
            }

        match = find_best_trip_match(target_text, trips)
        if not match:
            return {
                "ok": False,
                "message": (
                    f"I couldn't find a trip matching '{target_text}'. "
                    "Please use the exact trip name from the UI."
                ),
            }

        trip_id = match.get("trip_id") or match.get("id") or match.get("tripId")
        display_name = (
            match.get("display_name") or match.get("name") or f"Trip {trip_id}"
        )
        scheduled_date = match.get("scheduled_date") or match.get("date") or "today"

        # deployment info
        deployment = None
        try:
            dep = node_get(f"/api/helpers/deployment_for_trip/{trip_id}")
            if isinstance(dep, dict):
                if dep.get("found") and dep.get("deployment"):
                    deployment = dep["deployment"]
                elif dep.get("deployment"):
                    deployment = dep["deployment"]
            else:
                deployment = dep
        except Exception as e:
            logger.exception("Error fetching deployment for tripsheet %s: %s", trip_id, e)

        vehicle_id = deployment.get("vehicle_id") if deployment else None
        driver_id = deployment.get("driver_id") if deployment else None

        # bookings
        total_bookings = 0
        confirmed = 0
        cancelled = 0  # we only see confirmed via /api/bookings/trip
        bookings_raw = []
        try:
            b = node_get(f"/api/bookings/trip/{trip_id}")
            if isinstance(b, list):
                bookings_raw = b
                total_bookings = len(b)
                # if status field exists, count confirmed; otherwise treat all as confirmed
                for row in b:
                    status = (row.get("status") or "").lower()
                    if status == "confirmed" or status == "":
                        confirmed += 1
                    elif status == "cancelled":
                        cancelled += 1
            elif isinstance(b, dict):
                total_bookings = int(b.get("count", 0))
                confirmed = total_bookings
            else:
                total_bookings = int(b or 0)
                confirmed = total_bookings
        except Exception:
            logger.info(
                "Could not fetch bookings for tripsheet trip %s; defaulting to 0",
                trip_id,
            )

        lines = []
        lines.append(f"Tripsheet — {display_name} ({scheduled_date})")
        lines.append(f"Trip ID: {trip_id}")
        lines.append("")
        lines.append(
            f"Vehicle: {vehicle_id if vehicle_id is not None else 'None assigned'}"
        )
        lines.append(
            f"Driver: {driver_id if driver_id is not None else 'None assigned'}"
        )
        lines.append("")
        lines.append(f"Bookings: {total_bookings} total")
        lines.append(f" - Confirmed: {confirmed}")
        lines.append(f" - Cancelled: {cancelled}")
        lines.append("")
        lines.append("Notes:")
        if deployment is None:
            lines.append(" - No vehicle is currently deployed on this trip.")
        else:
            lines.append(
                " - Vehicle and driver are already deployed for this trip."
            )
        if total_bookings == 0:
            lines.append(" - There are currently no confirmed bookings.")

        msg = "\n".join(lines)

        return {
            "ok": True,
            "message": msg,
            "trip": {
                "trip_id": trip_id,
                "display_name": display_name,
                "scheduled_date": scheduled_date,
            },
            "deployment": deployment,
            "bookings": {
                "total": total_bookings,
                "confirmed": confirmed,
                "cancelled": cancelled,
                "raw": bookings_raw,
            },
        }

    # 10) greetings / generic queries / fallback
    if parsed_intent and parsed_intent.get("intent") == "greeting":
        return {
            "ok": True,
            "message": (
                "Hi — I'm Movi. I can help manage trips, routes, vehicles and bookings. "
                "Try things like:\n"
                " - 'What is the status of Bulk - 00:01?'\n"
                " - 'Assign vehicle 2 to Bulk - 00:01'\n"
                " - 'Show trips with no vehicle'\n"
                " - 'Generate tripsheet for Bulk - 00:01'."
            ),
        }

    if parsed_intent and parsed_intent.get("intent") == "query":
        return {
            "ok": True,
            "message": (
                "I understood this as a general query but I don't yet have a specific action wired for it. "
                "Try asking about a particular trip or route, for example: "
                "'status of Bulk - 00:01', 'show all trips', or 'list routes'."
            ),
        }

    # catch-all
    return {
        "ok": False,
        "message": (
            "I couldn't map this to an action. "
            "Try something like:\n"
            " - 'Assign vehicle 1 to Bulk - 00:01'\n"
            " - 'Remove vehicle from Bulk - 00:01'\n"
            " - 'Show all trips'\n"
            " - 'Tripsheet for Bulk - 00:01'."
        ),
    }


# --------------------------
# FastAPI endpoints
# --------------------------


@app.post("/ai/agent")
def ai_agent(req: AgentRequest):
    text = (req.input or "").strip()

    # Greeting quick path
    if text.lower() in ("hi", "hello", "hey", "hey movi", "hi movi"):
        return {
            "ok": True,
            "message": (
                "Hi — I'm Movi. I can help manage trips, routes and vehicles. "
                "Try: 'Remove the vehicle from Bulk - 00:01', "
                "'Assign vehicle 1 to Bulk - 00:01', or "
                "'What is the status of Bulk - 00:01?'."
            ),
        }

    # confirmation path
    if req.pendingId and text.lower() in (
        "yes",
        "y",
        "confirm",
        "proceed",
        "ok",
        "okay",
        "sure",
    ):
        logger.info("Processing confirmation for pendingId=%s", req.pendingId)
        result = perform_consequence_check_and_maybe_execute(
            {"intent": "confirm"}, pending_id=req.pendingId
        )
        logger.info("Confirmation result: %s", result)
        return result

    # parse intent (LLM optional)
    parsed = None
    if OPENAI_API_KEY and text:
        try:
            prompt = f"""
You are an assistant for a bus transport operations system.

Extract intent and target_text from this user message.

Allowed intents:
- "remove_vehicle": user wants to unassign/cancel a vehicle or deployment from a trip.
- "assign_vehicle": user wants to allocate/assign/deploy a vehicle (and optional driver) to a trip.
- "trip_query": asking about a specific trip or bus service (status, bookings, vehicle, etc.).
- "route_query": asking about a bus route (stops, direction, trips on that route, etc.).
- "list_trips": asking to list today's trips.
- "list_unassigned_trips": asking which trips don't have a vehicle/bus assigned.
- "list_routes": asking to list the available routes.
- "tripsheet": asking for a tripsheet / trip summary for a specific trip.
- "confirm": confirming a pending destructive action (yes, proceed, okay, etc.).
- "greeting": simple greeting like hi/hello.
- "unknown": anything else.

For intents that relate to a specific trip or route
("remove_vehicle", "assign_vehicle", "trip_query", "tripsheet"),
set target_text to the most relevant trip phrase mentioned
(for example "Bulk - 00:01", "TechLoop - 09:00").

For list_trips, list_routes, list_unassigned_trips, target_text can be null.

Respond ONLY with valid JSON in this shape:
{{"intent": "<one of the intents above>", "target_text": <string or null>}}

Message: "{text}"
"""
            llm_out = call_llm(prompt)
            parsed_json = json.loads(llm_out) if llm_out else {}
            parsed = {
                "intent": parsed_json.get("intent"),
                "target": parsed_json.get("target_text"),
            }
        except Exception as e:
            logger.warning("LLM parse failed: %s - falling back", e)
            parsed = fallback_parse_intent(text)
    else:
        parsed = fallback_parse_intent(text)

    # If still unknown but looks like "Bulk - 00:01" style, treat as trip_query
    if not parsed or parsed.get("intent") in (None, "unknown"):
        if _looks_like_trip_or_route_name(text):
            parsed = {"intent": "trip_query", "target": text}
        else:
            parsed = parsed or {"intent": "unknown", "target": None}

    # Attach raw_text so business logic can re-parse vehicle/driver ids etc.
    parsed["raw_text"] = text

    logger.info("Parsed intent: %s", parsed)

    result = perform_consequence_check_and_maybe_execute(
        parsed,
        image_text=req.imageText,
        pending_id=req.pendingId,
        current_page=req.currentPage,
    )
    logger.info("Action result: %s", result)
    return result


@app.get("/ai/health")
def health():
    return {
        "ok": True,
        "node_backend": NODE_BACKEND,
        "openai": bool(OPENAI_API_KEY),
    }
