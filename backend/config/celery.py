"""
Celery application definition.

Role in system
--------------
Defines the Celery worker application used for distributed AI processing.

Flow position
-------------
Kafka Consumer → Celery Queue → AI Worker → Database

Responsibilities
---------------
- Create the Celery application
- Load Django settings
- Auto-discover tasks defined in Django apps
- Configure the broker (Redis)
- Provide a single entrypoint for starting Celery workers

Notes
-----
- This module is imported by both Django and the Celery worker process.
- Workers started from this app execute AI processing tasks asynchronously, such as tasks defined in core/tasks.py.

Workers started from this module execute AI processing tasks asynchronously.
"""

import os
from celery import Celery

# Set the default Django settings module for the Celery program
# Ensures that Django configuration is loaded when Celery starts
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.config.settings")

# Create a Celery instance named after the Django project
# This instance represents the Celery app used for all tasks
app = Celery("backend")

# Load configuration from Django settings, using the CELERY namespace
# This allows using settings like:
#   CELERY_BROKER_URL
#   CELERY_ACCEPT_CONTENT
#   CELERY_TASK_SERIALIZER
#   CELERY_RESULT_SERIALIZER
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks.py in all installed apps
# This allows Celery to know about all @shared_task functions, e.g., add()
# in core/tasks.py, without manually importing them
app.autodiscover_tasks()
