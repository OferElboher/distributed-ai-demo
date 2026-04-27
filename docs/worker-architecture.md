# Worker Architecture and Execution Model

## Overview

This project uses an asynchronous processing architecture to handle email analysis.

The system is divided into two independent components:

- **API Server (Producer)** — receives requests and enqueues jobs
- **Worker (Consumer)** — processes jobs from the queue

These components communicate through a Redis-backed queue.

---

## Why the Worker Is Not Started Automatically

The worker (`reviewWorker.js`) is **not automatically executed** when starting the API server.

This is intentional and follows standard production architecture.

### Reason

The API and the worker are designed as **separate processes**.

They must be started independently:

```bash
# Terminal 1
node src/app.js

# Terminal 2
node src/worker/reviewWorker.js