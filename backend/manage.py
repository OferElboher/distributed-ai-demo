#!/usr/bin/env python

"""
Django management entrypoint.
Django's command-line utility for administrative tasks.

Role in system
--------------
This file serves as the command-line entrypoint for Django administrative tasks within the distributed AI demo.
It allows developers and the system to:

- Start the Django REST API server
- Run database migrations
- Launch the Kafka consumer command via custom management commands
- Perform other Django admin tasks (createsuperuser, collectstatic, etc.)

Flow
----
CLI -> manage.py -> main() -> Django execute_from_command_line -> REST API / commands

Responsibilities
----------------
- Set default Django settings module
- Import Django management utilities
- Execute commands provided via CLI
- Handle ImportError if Django is not installed
- Serve as the main entrypoint for running the API and management tasks

Notes
-----
- This is the "REST API layer entrypoint" of the distributed AI architecture.
- All administrative commands (including starting the Kafka consumer or Celery tasks)
  are executed via this main() function.

This file effectively **starts the REST API layer** of the architecture and provides access to all standard Django management operations.
"""

import os
import sys


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)


def main():
    """
    Main entrypoint for Django administrative tasks.

    This function is automatically called when running `python manage.py <command>`.

    Flow:
    1. Ensure DJANGO_SETTINGS_MODULE is set to 'backend.settings'
    2. Import Django's execute_from_command_line
    3. If import fails, raise informative ImportError
    4. Pass sys.argv to Django for CLI execution

    Example usages:
    ----------------
    # Start the development server
    python manage.py runserver

    # Apply migrations
    python manage.py migrate

    # Run custom Kafka consumer command
    python manage.py run_kafka_consumer

    Parameters
    ----------
    None: Uses sys.argv from CLI automatically

    Returns
    -------
    None: Executes the requested Django command
    """
    # Ensure the Django settings module is defined
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    # Execute the Django command specified in sys.argv
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
