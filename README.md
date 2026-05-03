# Suspicious Email Triage System

## Overview
This project is a full-stack email triage system that analyzes suspicious emails using:
- rule-based detection (backend worker)
- LLM-assisted reasoning (Ollama)
- real-time UI polling dashboard

---

## Architecture

Frontend (React)
- Submits email for analysis
- Polls backend for status updates
- Displays verdict, findings, and recommendations

Backend (Node.js + Express)
- Stores reviews in MongoDB
- Queues analysis jobs via BullMQ (Redis)
- Exposes REST API for frontend

Worker
- Processes review jobs
- Runs rule-based security heuristics
- Calls local LLM (Ollama)
- Combines results into final structured output

Storage
- MongoDB stores reviews + analysis results

Queue
- Redis + BullMQ handles async processing

LLM Layer
- Ollama local model (e.g. llama3)
- Enforced JSON structured output

---

## Setup

### 1. Start infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
