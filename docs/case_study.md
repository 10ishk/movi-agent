# Case Study: Movi AI Operations Copilot

## Context

Transport administrators often manage trips, routes, vehicle assignments, drivers, and bookings across multiple screens. This creates repetitive lookup work and increases the risk of accidental changes when actions affect active bookings.

## Problem

The goal was to prototype an AI copilot that could sit inside a transport admin dashboard and help users interact with operational data through natural language while preventing unsafe automatic actions.

## Approach

Movi uses a React dashboard, a FastAPI AI agent, a Node.js/Express backend, and a SQLite database. The agent parses the user's request, resolves trip or route entities, calls backend APIs, and returns an operational response.

## Safety Design

For destructive actions, the agent checks backend state before execution. If a trip has active bookings, the agent creates a pending confirmation instead of immediately removing the vehicle assignment.

## Implementation Highlights

- Rule-based intent parser with optional LLM parsing
- Fuzzy trip and route matching
- Backend-connected trip, route, booking, and deployment workflows
- Human-in-the-loop confirmation for risky operations
- Browser voice input and text-to-speech output

## Results

The prototype demonstrates how applied AI can be connected to operational backend systems while keeping sensitive actions under user control.

## Future Improvements

Future work includes OCR-based screenshot parsing, multimodal AI support, LangGraph orchestration, persistent audit logs, authentication, tests, and deployment hardening.
