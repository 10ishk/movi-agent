# Movi Transport Intelligence System (MTIS) – Master Architecture Document (“The Vision”)
Status: **In Progress**
Last updated: 2025-12-01  
Owner: **Tanishk Bhardwaj**

---

## 1. Master Architecture (“The Vision”)

### 1.1 High-Level Summary
- **MTIS** is a multimodal, intelligent transport operations platform that manages the full workflow: **Stops → Paths → Routes → Trips → Deployments**.
- It includes an integrated conversational assistant called **Movi AI**, capable of understanding **text, voice, images, and UI context**.
- Movi AI helps operators create routes, read trip status, deploy vehicles, and perform complex operations safely.
- MTIS improves operational efficiency, reduces errors, and supports natural interaction for transport managers.

### 1.2 Vision vs Current State

**Vision (Ideal End-State)**  
- MTIS is a robust, multimodal, graph-driven transport orchestration system.  
- Movi AI can perform safe CRUD operations, analyze screenshots, and run multi-step dialogs with consequence checks.  
- Fully modular LangGraph architecture with stateful reasoning and tool orchestration.

**Current State (Prototype)**  
- Full-stack implementation exists: React UI, Node backend, Python LangGraph agent, SQLite DB.  
- Movi AI handles text/voice/image input, entity resolution, consequence checking, and safe action execution.  
- Demo-quality, not production-scaled.

**Gaps**  
- Production-grade logging  
- More reliable screenshot mapping  
- Advanced booking logic  
- Better observability and deployment automation

---

## 2. Goals & Non-Goals

### 2.1 Core Design Goals
- **G1:** Provide a conversational interface through Movi AI for key transport tasks.  
- **G2:** Prevent user mistakes with a built-in consequence-checking system.  
- **G3:** Support multimodal inputs (vision, audio, text).  
- **G4:** Maintain a modular, extensible pipeline.  
- **G5:** Run entirely in local development for demonstration.

### 2.2 Non-Goals
- NG1: Enterprise RBAC or SSO.  
- NG2: High-scale or distributed backend systems.  
- NG3: Fully production-grade DevOps.

---

## 3. High-Level System Overview

### 3.1 Context & Inputs/Outputs

**Inputs:**
- Text chat  
- Microphone audio → STT  
- Image/screenshot uploads  
- UI context (`currentPage`)

**Outputs:**
- Movi AI responses  
- TTS audio  
- DB CRUD operations  
- Confirmation prompts  
- Logs and diagnostics

### 3.2 Textual System Diagram

```
[User]
  -> [React Frontend]
      -> Movi AI Chat Widget
          -> POST /api/agent?currentPage=<page>
             -> [Node Backend]
                 -> Proxy to Python LangGraph Agent
                     -> Tools:
                         - Intent Parser
                         - DB Query Tool
                         - DB Write Tool
                         - Vision Tool (OpenAI)
                         - STT Tool (OpenAI Realtime)
                         - TTS Tool
                         - Screenshot Trip Parser
                         - Booking Calculator
                         - Consequence Checker
                         - Confirmation Handler
                     -> Executes actions via Backend REST APIs
             <- Response (text + optional audio)
      <- UI updates + Movi AI messages
```

---

## 4. Component Architecture

### 4.1 Frontend (React)

**Responsibilities**
- Display MTIS UI pages (ManageRoute & BusDashboard)  
- Render Movi AI chat widget  
- Provide microphone and image upload integration  
- Send user input + `currentPage` to backend

**Boundaries**
- No business or reasoning logic in frontend

---

### 4.2 Backend (Node.js + Express)

**Responsibilities**
- REST API for MTIS data entities (Stops, Paths, Routes, Trips, Deployments, etc.)  
- Proxy channel between frontend and Movi AI (LangGraph agent)  
- SQLite data access & validation

**Key APIs**
- `/api/stops`  
- `/api/paths`  
- `/api/routes`  
- `/api/dailyTrips`  
- `/api/deployments`  
- `/api/vehicles`  
- `/api/drivers`  
- `/api/bookings`  
- `/api/agent?currentPage=pageName`

---

### 4.3 SQLite Database

Stores both static and dynamic transport data:
- stops  
- paths  
- routes  
- dailyTrips  
- deployments  
- vehicles  
- drivers  
- bookings  

---

### 4.4 Movi AI (Python LangGraph Agent)

**Responsibilities**
- Interpret user inputs  
- Understand transport system context  
- Maintain dialog state  
- Perform consequence checks  
- Execute safe CRUD operations via backend  
- Produce text + TTS responses  

**Core Nodes**
- `agent_entry`  
- `parse_intent`  
- `resolve_entities`  
- `check_consequences`  
- Conditional Flow  
- `get_confirmation`  
- `execute_action`  
- `post_action_notify`

---

## 5. Data & File Flows

### 5.1 Storage Locations
- DB: `backend/data/movi.db`  
- Uploads: `backend/uploads/`  
- Logs: `ai_agent/logs/`  

### 5.2 Cleanup
- Uploaded screenshots removed after use  
- Logs rotated manually or reset per run  

### 5.3 High-Level Schemas
- JSON-based `ordered_stop_ids`  
- API wrapper: `{ success, data, error? }`

---

## 6. Configuration Model

### 6.1 Sources
- `.env`  
- System environment  
- Hardcoded defaults  

### 6.2 Precedence
1. CLI Flags  
2. Env Vars  
3. Config Files  
4. Defaults  

### 6.3 Config Structures

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

### 7.1 Performance
- OpenAI API calls dominate latency  
- SQLite fine for local demo  
- Audio processed sequentially

### 7.2 Failure Modes
- Vision/STT errors → retry  
- Booking conflicts → initiate confirmation  
- DB errors → log + fail gracefully  

### 7.3 Observability
- Local logs  
- Minimal metrics (optional)  

---

## 8. User Interfaces

### 8.1 CLI (Developer)
- Run frontend, backend, agent locally

### 8.2 GUI (User)
- **ManageRoute:** create static assets  
- **BusDashboard:** manage daily trips & deployments  
- Movi AI widget available on all screens

---

## 9. Phase / Step Log

### Phase 1 — System Setup  
Status: Completed  
- React UI  
- Express backend  
- SQLite  
- Basic agent service  

### Phase 2 — LangGraph Core  
Status: In Progress  
- Intent parsing  
- Entity resolution  
- Consequence logic  
- Tool orchestration  

### Phase 3 — Polishing & Demo  
Status: Planned  
- Multimodal refinements  
- Final video demo  

---

## 10. Future Work

- Enhanced booking engine  
- RBAC  
- Docker deploy templates  
- Production observability  

---

## Appendix A — LangGraph Tools

1. DB Query Tool  
2. DB Write Tool  
3. Intent Parser Tool  
4. Vision Tool  
5. Image Parser  
6. STT Tool  
7. TTS Tool  
8. Booking Calculator  
9. Consequence Checker  
10. Confirmation Handler  
11. Logger/Audit Tool  
12. Image Annotator (optional)

---

## Appendix B — Example Agent State
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

## Appendix C — Consequence Flow Machine
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

# ✅ MTIS MAD is fully updated and ready.
