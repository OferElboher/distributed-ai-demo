# Image Build and Production Deployment

This document explains:

1. How the Docker image is built
2. How environment variables are injected
3. How containers are started in production
4. The full deployment flow

---

# Architecture Overview

Build time and runtime are **separate stages**:

```
Build stage
-----------
Dockerfile builds image
(no secrets available)

Runtime stage
-------------
docker-compose starts container
.env variables injected here
```

This separation prevents secrets from being baked into images.

---

# 1. Docker Image Build

The Docker image is built from the Dockerfile:

Example:

```
backend/Dockerfile
```

Typical build:

```bash
docker compose build
```

or

```bash
docker build -t distributed-ai-backend ./backend
```

During this stage:

* Python dependencies installed
* Code copied into image
* No environment secrets available
* `.env` is NOT loaded

This is intentional for security.

---

# 2. Environment Variables

Environment variables are loaded using:

```
docker-compose.yml
```

Example:

```yaml
backend:
  build: ./backend
  env_file:
    - ./backend/.env
```

This means:

* `.env
