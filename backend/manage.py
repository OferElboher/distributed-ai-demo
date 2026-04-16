#!/usr/bin/env python

import os
import sys
from pathlib import Path

"""
Django management entrypoint.
Django's command-line utility for administrative tasks.
"""

# Ensure project root is in Python path.
# Note: The relative path of this module is <.../distributed-ai-demo/backend/manage.py>.
BASE_DIR = Path(__file__).resolve().parent  # <.../distributed-ai-demo/backend/>
PROJECT_ROOT = BASE_DIR.parent  # <.../distributed-ai-demo/>
sys.path.insert(0, str(PROJECT_ROOT))


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

    # Ensure Django settings module is defined
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.backend.settings")

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Check PYTHONPATH / virtualenv setup."
        ) from exc

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
