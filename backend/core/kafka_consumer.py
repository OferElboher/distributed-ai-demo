from kafka import KafkaConsumer
import json
from core.tasks import add

consumer = KafkaConsumer(
    "ai_tasks",
    bootstrap_servers="localhost:9092",
    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
)


def start():
    for message in consumer:
        data = message.value
        add.delay(data["x"], data["y"])
