# Movi Agent — GenAI Assignment

## Overview
This project simulates a multimodal AI assistant (**Movi**) that manages transportation routes, vehicles, drivers, and bookings.

## Current Progress
✅ SQLite database with seeded data  
✅ Node.js backend API with Express  
✅ REST endpoints for stops, paths, routes, vehicles, drivers, daily trips, deployments, and bookings  
✅ `/api/agent` endpoint implementing AI consequence-check and confirmation flow  

## Next Steps
- Add LangGraph Python agent (LangChain integration)
- Add React frontend with Movi chat widget
- Add TTS/voice and image input simulation

## How to Run Backend
```bash
cd backend
npm install
npm run dev
