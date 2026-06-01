# Architecture

Movi is organized as a local full-stack prototype with three main services.

```text
React Dashboard
  -> FastAPI AI Agent
  -> Node.js / Express Backend
  -> SQLite Database
```

## Frontend

The frontend is a React and TypeScript dashboard built with Vite. It contains:

- daily trip dashboard
- route management page
- floating Movi assistant widget
- browser voice input/output hooks
- image upload hook reserved for future OCR integration

The frontend reads API URLs from Vite environment variables with localhost fallbacks.

## AI Agent

The AI agent is implemented in Python with FastAPI. It handles:

- intent parsing
- rule-based fallback parsing
- optional LLM-based parsing
- trip and route entity matching
- backend API calls
- consequence checking
- pending confirmation state

## Backend

The backend is implemented in Node.js and Express. It exposes REST APIs for:

- stops
- paths
- routes
- vehicles
- drivers
- daily trips
- deployments
- bookings
- helper lookups

## Database

SQLite is used for local persistence with synthetic sample data. The schema covers stops, paths, routes, vehicles, drivers, daily trips, deployments, and bookings.

## Safety Flow

Risky actions are not executed immediately. For example, before removing a vehicle from a trip, the agent checks active bookings. If bookings exist, it creates a pending confirmation and waits for the user to confirm before executing the action.
