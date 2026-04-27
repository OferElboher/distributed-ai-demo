# RUNNING_THE_STACK.md

This project consists of:
- MongoDB (system service)
- Node.js backend (API)
- Node.js worker
- React frontend

---

## Prerequisite

MongoDB must be running (systemd):

```bash
sudo systemctl status mongod
```

Expected:
- Active: running

---

## Terminal Setup (3 terminals required)

### Terminal 1 — Backend (API)

```bash
cd ~/suspicious-email-triage/backend
node src/app.js
```

Expected output:
- "Server running on port 3000"
- "MongoDB connection established"

---

### Terminal 2 — Worker

```bash
cd ~/suspicious-email-triage/backend
node src/worker/reviewWorker.js
```

Expected output:
- "Worker connected to MongoDB"

---

### Terminal 3 — React Frontend

```bash
cd ~/suspicious-email-triage/frontend
npm start
```

Notes:
- If prompted about port 3000 → press `Y`
- React will run on port 3001

---

## Access Application

Open browser:

```
http://localhost:3001
```

---

## Basic Health Checks

### Backend

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

---

### MongoDB

```bash
mongosh --port 27018 --eval "db.runCommand({ ping: 1 })"
```

Expected:

```json
{ ok: 1 }
```

---

## Notes

- MongoDB runs on port **27018**
- Backend runs on port **3000**
- Frontend runs on port **3001**
- Worker runs in background (no port)

---

## Common Issues

### Port conflict (3000)

Cause: backend already using it

Solution:
- Allow React to switch to 3001

---

### Mongo connection errors

Check:

```bash
systemctl status mongod
```

---

### Backend not responding

Check logs in Terminal 1

---

## End State (Everything Working)

- MongoDB: running
- Backend: running
- Worker: running
- Frontend: running

All set.

