"""
Kafka consumer.

Role in system
--------------
Consumes Kafka events and forwards them to Celery workers.

Flow
----
Kafka → Consumer → Celery → AI Worker

Responsibilities
---------------
- Subscribe to topic
- Deserialize events
- Send Celery tasks

This layer bridges event streaming with async worker processing.
"""

import json
from kafka import KafkaConsumer
import os
from typing import Dict, Any

from core.tasks import add


# Kafka topic to subscribe to.
TOPIC_NAME = "ai_tasks"


# Global Kafka consumer instance.
# Runs as a long-lived process that continuously listens for new events coming from REST API via Kafka producer.
consumer = KafkaConsumer(
    TOPIC_NAME,
    bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092"),
    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
)


def start() -> None:
    """
    Start Kafka consumer loop.

    Role in system
    --------------
    Event ingestion layer that converts Kafka messages into Celery async tasks.

    Flow
    ----
    Kafka → start() → Celery task → Worker

    Behavior
    --------
    - Blocks forever
    - Waits for Kafka messages
    - Deserializes JSON payload
    - Sends Celery task asynchronously

    Message Format
    --------------
    Expected Kafka message payload:

    {
        "x": 1,
        "y": 2
    }

    Processing
    ----------
    Each message triggers:

        add.delay(x, y)

    which runs asynchronously in Celery worker.

    Returns
    -------
    None

    Notes
    -----
    This function runs forever and should be started in a dedicated process:

        python manage.py run_kafka_consumer

    Multiple consumers may run in parallel for horizontal scaling.
    """

    for message in consumer:
        data: Dict[str, Any] = message.value

        # Forward message to Celery worker.
        add.delay(data["x"], data["y"])
