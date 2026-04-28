"""
Celery bootstrap.

Role in system
--------------
Ensures Celery app loads when Django starts.

This allows:

- Django → Celery integration
- Shared tasks discovery
- Worker auto-registration
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
