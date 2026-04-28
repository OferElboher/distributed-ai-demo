# Distributed AI Demo — Architecture

## 1. System Overview

This project demonstrates a **distributed AI processing pipeline** built using:

* Django (REST API)
* Kafka (event bus)
* Celery (task queue)
* Redis (Celery broker)
* AI workers (processing layer)
* Postgres / Mongo (storage)
* Docker Compose (infrastructure)

The system is intentionally **decoupled** to simulate production-grade distributed architecture.

---

# 2. High-Level Data Flow

```
Client
  ↓
Django REST API
  ↓
Kafka Producer
  ↓
Kafka Topic (ai_tasks)
  ↓
Kafka Consumer
  ↓
Celery Task Queue
  ↓
AI Worker
  ↓
Database (Postgres / Mongo)
```

This architecture allows:

* asynchronous processing
* horizontal scaling
* service isolation
* replayable events
* multi-consumer pipelines

---

# 3. Component Hierarchy

```
                ┌──────────────┐
                │   Client     │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Django REST  │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Kafka Topic  │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Kafka Consumer│
                └──────┬────────┘
                       │
                       ▼
                ┌──────────────┐
                │ Celery Queue │
                └──────┬────────┘
                       │
                       ▼
                ┌──────────────┐
                │ AI Worker    │
                └──────┬────────┘
                       │
                       ▼
                ┌──────────────┐
                │ Database     │
                └──────────────┘
```

---

# 4. Project Structure

```
distributed-ai-demo/
│
├── backend/
│   ├── backend/
│   │   ├── settings.py
│   │   └── celery.py
│   │
│   └── core/
│       ├── views.py
│       ├── kafka_producer.py
│       ├── kafka_consumer.py
│       ├── tasks.py
│       └── models.py
│
├── infra/
│   └── docker-compose.yml
│
├── docs/
│   └── architecture.md
│
├── pyproject.toml
└── README.md
```

---

# 5. Components

## 5.1 Django REST API

Location:

```
backend/core/views.py
```

Role:

* Entry point for clients
* Validates input
* Publishes events to Kafka
* Returns immediate response

Flow position:

```
Client → REST API → Kafka
```

---

## 5.2 Kafka Producer

Location:

```
core/kafka_producer.py
```

Role:

* Serialize event
* Send to Kafka topic
* Decouple REST from processing

Flow:

```
REST → Kafka Producer → Kafka Topic
```

---

## 5.3 Kafka Topic

Topic name:

```
ai_tasks
```

Role:

* Event streaming layer
* Message persistence
* Multiple consumer support

This is the **central event bus**.

---

## 5.4 Kafka Consumer

Location:

```
core/kafka_consumer.py
```

Role:

* Listen to Kafka topic
* Deserialize message
* Send task to Celery

Flow:

```
Kafka → Consumer → Celery
```

---

## 5.5 Celery Queue

Broker:

```
Redis
```

Role:

* Background task scheduling
* Worker distribution
* Retry support

Flow:

```
Kafka Consumer → Celery Queue → Worker
```

---

## 5.6 AI Worker

Location:

```
core/tasks.py
```

Role:

* Execute AI logic
* Process payload
* Save results

Flow:

```
Celery → AI Worker → Database
```

---

## 5.7 Database Layer

Postgres:

* structured results
* job metadata
* status tracking

Mongo:

* raw events
* AI output
* debugging payloads

---

# 6. Message Format

Example event:

```json
{
  "type": "analyze_text",
  "text": "hello world",
  "request_id": "uuid"
}
```

This message flows unchanged through:

```
REST → Kafka → Consumer → Celery → Worker
```

---

# 7. Execution Model

This system runs **multiple independent processes**:

### Process 1 — Django API

Handles incoming requests.

### Process 2 — Kafka Consumer

Reads Kafka messages continuously.

### Process 3 — Celery Worker

Executes AI tasks.

### Process 4 — Infrastructure

Docker containers:

* Kafka
* Redis
* Postgres
* Mongo
* RabbitMQ (optional)
* Zookeeper

---

# 8. How to Run the System

## Start infrastructure

```
cd infra
docker compose up -d
```

---

## Start Django API

```
cd backend
poetry run python manage.py runserver
```

---

## Start Celery worker

```
cd backend
poetry run celery -A backend worker -l info
```

---

## Start Kafka consumer

```
cd backend
poetry run python manage.py run_kafka_consumer
```

---

# 9. End-to-End Example

Client request:

```
POST /api/analyze
{
  "text": "hello AI"
}
```

Flow:

1. Django receives request
2. Django publishes Kafka event
3. Kafka stores event
4. Consumer reads event
5. Consumer sends Celery task
6. Worker executes AI logic
7. Result saved to DB

---

# 10. Scaling Model

Each layer scales independently:

REST:

* multiple Django instances

Kafka:

* partitioned topics

Consumer:

* consumer groups

Celery:

* multiple workers

AI:

* GPU workers possible

Database:

* read replicas

---

# 11. Failure Handling

Kafka:

* message persistence
* replay support

Celery:

* retry
* backoff
* dead-letter queues

Workers:

* idempotent processing

---

# 12. Future Extensions

Planned additions:

* multiple AI models
* model routing
* streaming responses
* job status API
* monitoring dashboard
* tracing
* metrics

---

# 13. Design Principles

This project follows:

* event-driven architecture
* async processing
* decoupled services
* horizontal scalability
* observable pipeline
* production-like topology

---

# 14. Summary

Pipeline:

```
REST API
    ↓
Kafka
    ↓
Consumer
    ↓
Celery
    ↓
AI Worker
    ↓
Database
```

Each layer is:

* independent
* scalable
* replaceable
* testable
