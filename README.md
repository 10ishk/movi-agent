# Movi - AI Operations Copilot for Transport Admin Workflows

Movi is a full-stack AI operations copilot prototype for transport administrators. It connects a React admin dashboard, a Python FastAPI AI agent, a Node.js/Express backend, and a SQLite database so users can query trips, inspect routes, generate trip summaries, and execute selected vehicle-deployment actions with confirmation safeguards.

The project focuses on applied AI integration: natural-language requests are translated into backend workflow actions, while risky operations require human confirmation before execution.

---

## Current Implementation

The current version includes:

- React and TypeScript transport admin dashboard
- Floating Movi AI assistant widget
- Python FastAPI AI agent for intent parsing and workflow orchestration
- Node.js and Express backend APIs
- SQLite database with synthetic transport operations data
- Trip, route, vehicle, driver, booking, and deployment workflows
- Rule-based intent parsing with optional OpenAI-compatible LLM parsing
- Fuzzy trip and route matching
- Trip status queries
- Route and trip listing
- Unassigned trip detection
- Vehicle assignment and removal workflows
- Human-in-the-loop confirmation before destructive actions
- Browser-based voice input and text-to-speech output
- Image upload hook reserved for future OCR/screenshot parsing

---

## Why This Project Matters

Transport operations teams often manage trips, routes, bookings, vehicles, and drivers across multiple screens. Movi demonstrates how an AI copilot can reduce manual navigation by letting an operator ask natural-language questions such as:

```text
Status of Bulk - 00:01
```

or execute guarded actions such as:

```text
Remove vehicle from Bulk - 00:01
```

Instead of blindly executing destructive actions, the agent checks operational consequences first. If a trip has active bookings, Movi asks for explicit confirmation before removing the vehicle assignment.

---

## Example Commands

```text
Show all trips
Status of Bulk - 00:01
Show trips with no vehicle
Generate tripsheet for Bulk - 00:01
Assign vehicle 3 to TechLoop - 09:00
Remove vehicle from Bulk - 00:01
List routes
```

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- Browser SpeechRecognition API
- Browser SpeechSynthesis API

### AI Agent

- Python
- FastAPI
- Pydantic
- Requests
- Optional OpenAI-compatible chat completion call
- Rule-based fallback parser
- Fuzzy entity matching

### Backend

- Node.js
- Express.js
- SQLite
- REST APIs

### Database

- SQLite
- Synthetic local transport operations data

---

## Architecture

```text
User
  -> React + TypeScript Admin Dashboard
  -> Movi AI Widget
  -> Python FastAPI Agent
  -> Node.js / Express REST APIs
  -> SQLite Database
```

The frontend sends user instructions and page context to the FastAPI agent. The agent parses intent, resolves trip or route names, calls backend APIs, checks business consequences, and returns a structured response to the dashboard.

---

## Core Workflow

```text
User command
  -> Intent parsing
  -> Entity resolution
  -> Backend data lookup
  -> Consequence check
  -> Confirmation required?
       -> Yes: create pending confirmation
       -> No: execute action
  -> Return response to dashboard
```

---

## Key Features

### 1. AI Operations Copilot

- Natural-language command handling
- Intent classification for transport workflows
- Optional LLM-based parser when an API key is available
- Rule-based fallback parser when no API key is configured
- Page-aware context through `currentPage`
- Trip and route entity resolution
- Fuzzy matching for imperfect user input

### 2. Transport Admin Dashboard

- Daily trip dashboard
- Route management page
- Trip list and selected trip details
- Floating Movi assistant widget
- Backend-connected route and trip loading with mock-data fallback

### 3. Backend API Layer

- REST APIs for stops, paths, routes, vehicles, drivers, daily trips, deployments, and bookings
- SQLite-backed local persistence
- Helper APIs for deployment and booking checks

### 4. Human-in-the-Loop Safety

Movi checks backend state before destructive actions. For example, before removing a vehicle from a trip, the agent checks:

- whether the trip exists
- whether a vehicle is currently assigned
- whether active bookings exist

If bookings exist, Movi creates a pending confirmation and waits for explicit user approval.

---

## Example: Confirmation-Protected Vehicle Removal

User:

```text
Remove vehicle from Bulk - 00:01
```

Movi checks the trip, deployment, and booking records. If active bookings exist, the response includes:

```json
{
  "ok": true,
  "confirmationRequired": true,
  "pendingId": "p_...",
  "message": "Trip 'Bulk - 00:01' has active booking(s). Removing the vehicle will cancel these bookings. Do you want to proceed?"
}
```

The user must confirm before the action is executed.

---

## Project Structure

```text
movi-agent-main/
  README.md
  .gitignore

  frontend/
    .env.example
    src/
      components/
      pages/
      App.tsx
      constants.tsx
      types.ts
    package.json
    vite.config.ts

  backend/
    data/
    routes/
    scripts/
    db.js
    server.js
    schema_and_seed.sql
    package.json

  ai_agent/
    .env.example
    app.py
    requirements.txt

  docs/
    architecture.md
    future_scope.md
    case_study.md

  assets/
    screenshots/
    diagrams/
```

---

## Setup Instructions

### 1. Initialize the Backend Database

```bash
cd backend
npm install
node scripts/init_db.js
```

This creates the local SQLite database from `schema_and_seed.sql`.

### 2. Start the Node.js Backend

```bash
cd backend
npm start
```

Backend URL:

```text
http://localhost:5000
```

### 3. Configure and Start the Python AI Agent

```bash
cd ai_agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app:app --reload --port 8000
```

Agent URL:

```text
http://localhost:8000
```

The agent can run without an OpenAI API key using its rule-based fallback parser.

### 4. Configure and Start the Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

---

## Environment Variables

### `frontend/.env.example`

```env
VITE_BACKEND_API=http://localhost:5000
VITE_AGENT_API=http://localhost:8000/ai/agent
VITE_IMAGE_API=http://localhost:5000/api/image/parse
```

### `ai_agent/.env.example`

```env
NODE_BACKEND=http://localhost:5000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
```

---

## API Examples

### Agent Health Check

```bash
curl http://127.0.0.1:8000/ai/health
```

### Ask the Agent for Trip Status

```bash
curl -X POST http://127.0.0.1:8000/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"input":"Status of Bulk - 00:01", "currentPage":"busDashboard"}'
```

### List Unassigned Trips

```bash
curl -X POST http://127.0.0.1:8000/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"input":"Show trips with no vehicle", "currentPage":"busDashboard"}'
```

### Trigger Confirmation-Protected Removal

```bash
curl -X POST http://127.0.0.1:8000/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"input":"Remove vehicle from Bulk - 00:01", "currentPage":"busDashboard"}'
```

---

## Data Source

The project uses synthetic local data seeded into SQLite. It does not include real passenger data, real company data, production credentials, or private operational records.

Sample entities include:

- Stops
- Paths
- Routes
- Daily trips
- Vehicles
- Drivers
- Deployments
- Bookings

---

## Current Limitations

- This is a local prototype, not a deployed production system.
- Authentication, role-based permissions, and multi-user access control are not implemented yet.
- Pending confirmations are currently stored in memory and reset when the FastAPI server restarts.
- The image upload flow is a placeholder hook for future OCR/screenshot parsing and does not perform production OCR.
- Audit logs and persistent action history are not implemented yet.
- Automated tests should be added before production use.

---

## Planned Enhancements / Future Scope

Planned future improvements include:

- OCR-based screenshot parsing for uploaded transport screenshots
- OpenAI Vision or similar multimodal model support for image-based operational queries
- OpenAI Realtime API or equivalent low-latency voice interaction
- LangGraph-based workflow orchestration for clearer agent state management and tool routing
- Authentication and role-based access control
- Persistent database-backed confirmation state
- Audit logs for AI-triggered actions
- Docker Compose setup for one-command local startup
- Unit and integration tests
- Deployment documentation
- Analytics dashboard for AI usage, failed queries, and operational actions

These items are future roadmap items and are not presented as completed features in the current implementation.

---