# Running the Distributed AI Demo

This document describes how to start each component of the distributed AI pipeline.

---

1. Start Django REST API

The REST API is the entrypoint for clients.

Commands:
cd ~/distributed-ai-demo/backend
poetry shell
python manage.py runserver

Flow:
Client -> Django REST API -> Kafka Producer -> Kafka -> Consumer -> Celery -> Worker

Notes:
- Default port: 8000
- API endpoint for submitting tasks: /api/submit
- Accepts JSON POST requests

Example request:
curl -X POST http://localhost:8000/api/submit -H "Content-Type: application/json" -d '{"task":"analyze_text","text":"hello world"}'

---

2. Start Kafka Consumer

The Kafka consumer reads messages from Kafka topics and forwards them to Celery workers.

Commands:
cd ~/distributed-ai-demo/backend
poetry shell
python manage.py run_kafka_consumer

Flow:
Kafka -> Consumer -> Celery -> Worker

Notes:
- Must run in a dedicated terminal/process
- Can run multiple consumers in parallel for scaling
- Blocking process; runs forever
- Consumes from topic: ai_tasks

---

3. Start Celery Workers

Celery workers execute the actual AI tasks.

Commands:
cd ~/distributed-ai-demo/backend
poetry shell
celery -A backend worker --loglevel=info

Flow:
Celery queue -> Worker -> Task execution -> (DB or result storage)

Notes:
- Can run multiple workers for parallel execution
- Logs show which tasks are being processed
- Example task: add(x, y) currently used as demo

---

4. Dockerized Infrastructure

The system relies on several backend services:

- PostgreSQL (structured DB)
- MongoDB (document storage)
- Redis (Celery broker)
- Kafka (event streaming)
- Zookeeper (Kafka coordination)
- RabbitMQ (optional queue)

Commands:
cd ~/distributed-ai-demo/infra
docker compose up -d

Notes:
- Ensure Docker Desktop + WSL integration is running
- All services are configured with default ports
- Kafka topic ai_tasks must exist

---

5. Development Notes

- Use poetry install to set up Python environment
- Use poetry shell before running any Python commands
- Logs are helpful to trace message flow:

Client -> REST -> Kafka -> Consumer -> Celery -> Worker -> Result

- For production, consider:
  - Environment variables for DB/Kafka/Redis addresses
  - Supervisor/systemd to manage long-running consumers and workers
  - Horizontal scaling with multiple consumers/workers
