# Movi AI Assistant – Master Architecture Document (“The Vision”)
Status: **In Progress**
Last updated: 2025-12-01
Owner: Tanishk Bhardwaj

---

## 1. Master Architecture (“The Vision”)

### 1.1 High-Level Summary
- Movi AI Assistant is a **multimodal**, **knowledge-aware**, full-stack transport management system enabling conversational control of Stops → Paths → Routes → Trips.
- It supports **text**, **voice**, and **image** inputs to perform real operations like creating stops, building paths, deploying vehicles, and checking dynamic trip status.
- Movi understands the operational flow and warns users before destructive actions using a **consequence-checking mechanism**.
- Primary goal: Help transport managers operate faster, reduce errors, and interact naturally with the system.

### 1.2 Vision vs Current State
- **Vision:**  
  A polished multimodal assistant built on robust LangGraph workflows, capable of safely orchestrating CRUD operations, analyzing screenshots, performing voice interactions, and maintaining multi-step dialog state.

- **Current State:**  
  A full-stack prototype exists (React frontend, Node backend, Python/LangGraph agent, SQLite database). API endpoints, DB schema, and core agent flows (intent parsing, entity resolution, consequence check, action execution) are implemented in demo quality.

- **Gaps:**  
  Production-level logging, job history, robust image parsing heuristics, and advanced booking engine are future upgrades.

---

## 2. Goals & Non-Goals

### 2.1 Core Design Goals
- **G1:** Provide a conversational interface for managing static (Stops/Paths/Routes) and dynamic (Trips/Deployments) transport data.
- **G2:** Prevent operational mistakes with explicit **consequence checking** before critical actions.
- **G3:** Support multimodal input (voice, image, text).
- **G4:** Maintain a clean, modular, easy-to-extend architecture.
- **G5:** Keep everything runnable locally with minimal setup.

### 2.2 Explicit Non-Goals
- **NG1:** Enterprise-grade RBAC, SSO, or multi-tenant security.
- **NG2:** High-scale or distributed backend processing.
- **NG3:** Production-grade cloud deployment or DevOps automation.

---

## 3. High-Level System Overview

### 3.1 Context & Inputs/Outputs
**Inputs:**
- Text queries
- Voice recordings (OpenAI Realtime → STT)
- Images/screenshots for trip/route detection
- UI context (currentPage)

**Outputs:**
- Chat responses
- TTS playback
- DB mutations (CRUD on stops/paths/routes/trips/deployments)
- Confirmation prompts
- Audit logs

### 3.2 Textual Diagram

```
[User]
   -> [React Frontend]
        -> MoviWidget
            -> POST /api/agent?currentPage=<page>
                -> [Node Backend]
                    -> Validate + proxy -> [Python LangGraph Agent]
                        -> Tools:
                             - DB Query Tool
                             - DB Write Tool
                             - Intent Parser
                             - Vision Tool (OpenAI)
                             - STT Tool (OpenAI Realtime)
                             - TTS Tool
                             - Image Parser
                             - Booking Calculator
                             - Consequence Checker
                             - Confirmation Handler
                        -> Backend REST APIs for write ops
                    <- return agent response
        <- display + TTS output
```

Error/Retry Flow:
- Vision/STT failures → ask for retry.
- Booking conflict → go to confirmation state.
- DB write issues → return error and log.

---

## 4. Component Architecture

### 4.1 Frontend (React + Vite)

**Responsibilities**
- BusDashboard & ManageRoute pages
- Display Movi chat widget & send context (`currentPage`)
- Handle microphone and image upload

**Key Boundaries**
- No business logic; all logic delegated to agent/back-end

**Public APIs**
- Calls backend REST APIs (`/api/stops`, `/api/paths`, `/api/routes`, etc.)
- Calls `/api/agent` for agent interactions

**Dependencies**
- React, Vite, Axios/fetch, Web Audio API

**Configuration**
- `REACT_APP_API_BASE`
- `REACT_APP_AGENT_URL`

**Operational Notes**
- SPA served by `vite dev`
- MoviWidget handles audio recording & playback

---

### 4.2 Backend (Node.js / Express)

**Responsibilities**
- Expose REST APIs for all transport objects
- Proxy multimodal requests to Python agent
- Handle SQLite DB access

**Key Public APIs** (shapes summarized)
- `/api/stops` – list/create stops
- `/api/paths` – list/create paths
- `/api/routes` – list/create routes
- `/api/dailyTrips` – list trips
- `/api/deployments` – create/delete deployments
- `/api/vehicles`, `/api/drivers`, `/api/bookings`
- `/api/agent?currentPage=...` – proxy agent request
- `/api/image` – upload endpoint (if needed)

**Dependencies**
- `express`, `sqlite3`, `multer`, `axios`

**Configuration**
- `PORT`
- `DATABASE_FILE`
- `AGENT_URL`

**Operational Notes**
- SQLite used for demo-quality local persistence
- Simple error handling + logs

---

### 4.3 SQLite Database

**High-Level Tables**
- `stops(stop_id, name, latitude, longitude)`
- `paths(path_id, path_name, ordered_stop_ids JSON)`
- `routes(route_id, path_id, route_display_name, shift_time, direction, start_point, end_point, status)`
- `vehicles(vehicle_id, license_plate, type, capacity)`
- `drivers(driver_id, name, phone_number)`
- `dailyTrips(trip_id, route_id, display_name, booking_count, capacity_at_booking_time, live_status)`
- `deployments(deployment_id, trip_id, vehicle_id, driver_id)`
- `bookings(booking_id, trip_id, user_id, status)` *(optional)*

**Notes**
- `ordered_stop_ids` stored as JSON for simplicity.
- Booking percentage is computed on the fly.

---

### 4.4 AI Agent (Python + LangGraph)

**Responsibilities**
- Intent recognition
- Entity resolution
- Safety / consequence checking
- Action execution via backend API
- Manage multimodal flows
- Maintain per-session dialog state

**Boundaries**
- Does not serve UI
- Does not manage production-level auth

**Public APIs**
- `POST /agent`
- Optional: `POST /agent/voice`
- Optional: `POST /agent/image`

**State Machine (Core LangGraph Flow)**

```text
[agent_entry]
    -> [parse_intent]
    -> [resolve_entities]
    -> [check_consequences]
         -> if consequences exist -> [get_confirmation]
             -> user yes -> [execute_action]
             -> user no  -> [abort_and_explain]
         -> else -> [execute_action]
    -> [post_action_notify]
```

---

## 5. Data & File Flows

### 5.1 Storage Locations
- Primary DB: `backend/data/movi.db`
- Uploads: `backend/uploads/`
- JSON seeds: `backend/data/trips.json`
- Agent logs: `ai_agent/logs/`

### 5.2 Lifecycle & Cleanup
- Temporary screenshots can be deleted post-resolution
- Logs rotated manually or per-run in demo

### 5.3 Object Schemas (high-level)
- `ordered_stop_ids`: `[1,2,3]`
- `live_status`: e.g., `"00:01 IN"` or `"SCHEDULED"`
- API responses wrap: `{ success, data, error? }`

---

## 6. Configuration Model

### 6.1 Sources
- `.env` files
- Env vars
- Defaults in code

### 6.2 Precedence
1. CLI Flags  
2. Environment Variables  
3. Config Files  
4. Hardcoded Defaults  

### 6.3 Key Config Structures

**Backend**
```json
{
  "port": 5000,
  "dbFile": "backend/data/movi.db",
  "agentUrl": "http://localhost:8000"
}
```

**Agent**
```json
{
  "openai_api_key": "<TBD>",
  "agent_port": 8000,
  "node_backend_url": "http://localhost:5000"
}
```

---

## 7. Operational Behaviour

### 7.1 Performance Considerations
- Dominated by OpenAI API latency (LLM, Vision, Realtime)
- SQLite handles low concurrency demo loads
- Audio is processed sequentially

### 7.2 Failure Modes
- Vision/STT error → agent asks for retry  
- Booking conflicts → agent enters confirmation state  
- DB error → return error + log  

### 7.3 Observability
- Local logging in backend and agent
- Basic counters can be added (demo)
- No distributed tracing

---

## 8. User Interfaces

### 8.1 CLI UX (Developer)
- `npm run dev` – frontend
- `node backend/server.js` – backend
- `python ai_agent/app.py` – agent

### 8.2 GUI UX

**ManageRoute**
- CRUD for stops, paths, routes
- Movi suggests operations relevant to static asset creation

**BusDashboard**
- Shows Trips, assigned vehicles, drivers, booking %  
- Screenshot-based multimodal actions enabled  
- Movi can dynamically read trip states and deploy/remove vehicles

**MoviWidget**
- Chat box + TTS playback  
- Microphone icon for voice input  
- Confirmation buttons for consequence flow  

### 8.3 Automation Hooks
- Lightweight audit webhook (optional)
- Agent client SDK (JS) can be extended for CI or scripts

---

## 9. Phase / Step Log (Implementation History)

### Phase 1 — Full-stack Setup  
**Status:** Completed  
- Frontend (React + Vite) pages scaffolded  
- Backend Express routes for all tables  
- SQLite DB created and seeded  
- Initial agent service created (`ai_agent/app.py`)

### Phase 2 — LangGraph Core & Consequence Flow  
**Status:** In Progress  
- Intent parsing  
- Entity resolution  
- Consequence-check conditions  
- Confirmation flow  
- Tool integration (OpenAI Vision, Realtime, LLM)

### Phase 3 — Multimodal Integration & Demo Polish  
**Status:** Planned  
- Clean voice recording pipeline  
- Screenshot mapping improvements  
- Final demo recording  

---

## 10. Future Work / Parking Lot

### 1. Enhanced Booking Engine  
**Type:** Feature  
More advanced logic for capacity, cancellation, seat mapping.

### 2. Role-Based Access Control  
**Type:** Security  
Add user roles for safety (managers vs operators).

### 3. Deployment Templates  
**Type:** Infra  
Docker/Compose setup for backend + agent + frontend.

### 4. Production Observability  
**Type:** Infra  
Structured logs + metrics + error monitoring.

---

## **Appendix A — LangGraph Tools (≥10 tools)**

1. DB Query Tool  
2. DB Write Tool  
3. Intent Parser Tool  
4. Vision Tool (OpenAI Vision)  
5. Image Parser Tool  
6. STT Tool (OpenAI Realtime/Whisper)  
7. TTS Tool  
8. Booking Calculator  
9. Consequence Checker  
10. Confirmation Handler  
11. Logger/Audit Tool  
12. Image Annotator (optional)

---

## **Appendix B — Example Agent State Shape**
```json
{
  "session_id": "s1",
  "currentPage": "busDashboard",
  "input": { "raw_text": "Remove the vehicle", "image_meta": null },
  "intent": { "action": "remove_vehicle", "entities": { "trip_name": "Bulk - 00:01" } },
  "resolved_entities": { "trip_id": 3, "vehicle_id": 7 },
  "consequences": { "booked_percentage": 25 },
  "awaiting_confirmation": true,
  "history": []
}
```

---

## **Appendix C — Consequence Flow Machine**
```
[agent_entry]
  → [parse_intent]
  → [resolve_entities]
  → [check_consequences]
        if critical
             → [get_confirmation] → yes → [execute_action]
                                       → no  → [abort]
        else
             → [execute_action]
  → [post_action_notify]
```

---

# ✅ The MAD is complete and saved to this repository file.
