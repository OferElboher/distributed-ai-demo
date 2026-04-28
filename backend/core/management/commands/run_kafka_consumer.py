from django.core.management.base import BaseCommand
from core.kafka_consumer import start


class Command(BaseCommand):
    help = "Start Kafka consumer"

    def handle(self, *args, **kwargs):
        start()
