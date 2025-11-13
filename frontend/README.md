# 🚍 Movi – Context-Aware AI Agent + Admin Dashboard  
### GenAI Interview Assignment – Full Implementation

This project implements Movi’s two-page Admin Dashboard combined with a **context-aware AI assistant** capable of understanding intent, analyzing consequences, confirming destructive actions, processing images, handling voice input, and interacting with a live backend (Node.js + SQLite).  
The solution meets (and exceeds) all the requirements outlined in the assignment.

---

# 🌟 Project Highlights

## 🎯 What This System Can Do
- Read user instructions via **text**, **voice**, or **images**
- Understand intent (LLM or fallback parser)
- Know which **page** the user is on (`busDashboard` or `manageRoute`)
- Evaluate risk / consequences before destructive actions  
  (e.g., “Removing vehicle will cancel 10 bookings…”)
- Require & validate confirmation (`pendingId`)
- Communicate with Node backend + SQLite DB
- Display results beautifully inside a React widget (with speech output)
- Work even without an OpenAI API key (fallback mode)

---

# 🧱 Architecture Overview

Frontend (React + Vite + TS)
↓
MoviWidget (text / voice / image)
↓
Python AI Agent (FastAPI)
↓
Node.js Backend (Express)
↓
SQLite Database (movi.db)

### 🔹 React Frontend
- Two admin pages:
  - `/dashboard` — Daily trips, deployments, bookings  
  - `/routes` — Routes, stops, path management
- Floating AI widget is visible on all pages
- Built with Vite + TypeScript

### 🔹 AI Assistant (Frontend Widget)
- Chat bubbles  
- Auto-scroll  
- Voice-to-text  
- Text-to-speech  
- Image upload → OCR text extraction  
- Sends:

{ input, imageText, pendingId, currentPage }

### 🔹 Python AI Agent (FastAPI)
- Intent parsing:
  - remove_vehicle  
  - confirm  
  - greeting  
  - query  
  - unknown
- Context-aware responses based on `currentPage`
- Consequence modeling:
  - Checks if a trip has deployments  
  - Counts bookings  
  - Creates a pending confirmation  
  - Requires safe execution
- Integration with OpenAI *optional*

### 🔹 Node Backend + SQLite
- REST API (CRUD routes)  
- Helper routes:
  - `/api/helpers/deployment_for_trip/:id`
  - `/api/helpers/bookings_for_trip/:id`
- OCR endpoint: `/api/image/parse`
- SQLite DB seeded with daily trips

---

# 📁 Project Structure
movi/
│
├── backend/ # Node.js Backend
│ ├── server.js
│ ├── data/movi.db
│ ├── routes/
│ ├── schema_and_seed.sql
│ ├── db_inspect_and_seed.py
│ └── image parser, helpers, etc.
│
├── ai_agent/ # Python AI Agent
│ ├── app.py
│ └── requirements.txt
│
└── frontend/ # React + TS Frontend
├── index.html
├── vite.config.ts
└── src/
├── pages/
├── components/
├── MoviWidget.tsx
└── App.tsx

---

# 🔧 Setup Instructions

## 1️⃣ Install & Start Backend (Node.js)
```bash
cd backend
npm install
node server.js

Install & Start Python AI Agent:
cd ai_agent
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

Install & Start Frontend (React + Vite):
cd frontend
npm install
npm run dev

Open Browser:
👉 http://localhost:5173


🤖 AI Agent – In Depth

Intent Parsing

The agent extracts:

remove_vehicle

confirm

greeting

query

fallback unknown

Uses OpenAI if OPENAI_API_KEY exists.
Otherwise: rule-based parser.

Consequence Modeling ("Tribal Knowledge")

When user asks:

"Remove the vehicle from Bulk - 00:01"

The agent does:

Identify target trip

Get deployment for trip

Get booking count

If bookings > 0 → create pending entry

{
  "confirmationRequired": true,
  "pendingId": "p_1739871231",
  "message": "Trip has active bookings. Confirm?"
}

UI shows “Confirm Pending” button

User clicks confirm →

agent deletes deployment

cancels bookings

responds with success message

---

🖼 Image Input Flow

User uploads screenshot

Widget converts to base64

Sends to /api/image/parse

Backend extracts text

imageText sent to Python agent

Agent uses it like normal input

🗣 Voice Input Flow

User speaks

Browser SpeechRecognition → text

Sent to AI agent

Agent responds

Browser SpeechSynthesis → spoken reply

Test agent:
curl http://127.0.0.1:8000/ai/health
Test remove vehicle:
curl -X POST http://127.0.0.1:8000/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"input":"Remove the vehicle from Bulk - 00:01", "currentPage":"busDashboard"}'
