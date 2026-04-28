# CI / Docker Environment Configurations and Build Commands

This document defines the **three supported runtime environments** in the Distributed AI Demo CI/CD system:

- Development (dev)
- Staging
- Production (prod)

It explains:
- How each environment is selected
- How configuration is resolved in Docker Compose
- Which `.env` file is used
- The exact build and execution commands

---

# 1. Overview of Environment Selection Model

The system uses a single selector:

```
ENVIRONMENT=dev | staging | prod
```

This variable controls:
- Which `.env` file is loaded
- Which Django settings module is activated
- Runtime behavior (DEBUG, logging, external services)

---

# 2. Environment Configurations

## 2.1 Development (dev)

### Purpose
Local development and CI unit testing.

### Configuration File
```
backend/.env.dev
```

### Key Characteristics
- DEBUG = True
- Local-friendly ALLOWED_HOSTS
- Uses mock-friendly or lightweight services

### Typical Services
- SQLite or lightweight DB fallback (CI override)
- Redis (optional)
- No external strict constraints

### Build & Run Commands

#### Docker build
```bash
docker compose -f infra/docker/docker-compose.yml build backend
```

#### Run backend (dev context)
```bash
ENVIRONMENT=dev docker compose -f infra/docker/docker-compose.yml up backend
```

#### Run Django checks manually
```bash
ENVIRONMENT=dev docker compose -f infra/docker/docker-compose.yml run --rm backend \
python backend/scripts/check_settings.py
```

---

## 2.2 Staging (staging)

### Purpose
Pre-production validation environment.

### Configuration File
```
backend/.env.staging
```

### Key Characteristics
- DEBUG = False
- Production-like behavior
- Safer logging and stricter settings
- Used for CI validation of production readiness

### Typical Services
- PostgreSQL (production-like schema)
- Redis (optional depending on pipeline stage)
- No Kafka required at this stage (unless explicitly enabled later)

### Build & Run Commands

#### Docker build
```bash
docker compose -f infra/docker/docker-compose.yml build backend
```

#### Run backend in staging mode
```bash
ENVIRONMENT=staging docker compose -f infra/docker/docker-compose.yml up backend
```

#### Validate settings
```bash
ENVIRONMENT=staging docker compose -f infra/docker/docker-compose.yml run --rm backend \
python backend/scripts/check_settings.py
```

---

## 2.3 Production (prod)

### Purpose
Production-like correctness validation (not actual deployment in CI).

### Configuration File
```
backend/.env.prod
```

### Key Characteristics
- DEBUG = False
- Strict ALLOWED_HOSTS
- Secure defaults
- No development shortcuts

### Typical Services
- PostgreSQL (production schema expectations)
- Redis (Celery broker)
- Kafka

### Build & Run Commands

#### Docker build
```bash
docker compose -f infra/docker/docker-compose.yml build backend
```

#### Run backend in production mode (CI validation only)
```bash
ENVIRONMENT=prod docker compose -f infra/docker/docker-compose.yml run --rm backend \
python backend/scripts/check_settings.py
```

---

# 3. Unified Build Strategy

All environments share the same build process:

## 3.1 Backend image build
```bash
docker compose -f infra/docker/docker-compose.yml build backend
```

This ensures:
- identical container runtime
- consistent PYTHONPATH
- reproducible dependency resolution

---

# 4. CI Execution Pattern

Each CI validation step follows the same pattern:

### Step structure
1. Select ENVIRONMENT
2. Load matching `.env.<env>` file
3. Run containerized Django command

### Generic command pattern
```bash
ENVIRONMENT=<env> docker compose -f infra/docker/docker-compose.yml run --rm backend \
python backend/scripts/check_settings.py
```

---

# 5. Key Design Principle

> Docker Compose resolves env_file paths at **compose-parsing time**, not at runtime.

This means:
- ENVIRONMENT must be known BEFORE container startup
- fallback logic is controlled by:
```
../../backend/.env.${ENVIRONMENT:-dev}
```

---

# 6. Summary

| Environment | Purpose | DEBUG | File |
|------------|--------|-------|------|
| dev        | local + CI unit tests | True  | .env.dev |
| staging    | pre-production validation | False | .env.staging |
| prod       | production correctness check | False | .env.prod |

---
