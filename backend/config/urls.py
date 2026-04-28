"""
URL routing configuration for backend project REST API.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))

Role in system
--------------
Defines REST entrypoints routing into the distributed AI pipeline.

Flow
----
Client → URL route → Django view → Kafka → Consumer → Celery → Worker

Responsibilities
---------------
- Route API endpoints
- Connect views
- Expose REST entrypoints

Endpoints
---------
/admin/
    Django admin interface

/api/submit
    Submit async AI task into distributed processing pipeline
"""

from django.contrib import admin
from django.urls import path, include

from core.views import submit_task

# URL routing table for REST API and admin interface.
# Each route maps HTTP endpoint → pipeline entrypoint view.
urlpatterns = [
    # Django admin UI panel (database inspection / debugging).
    # Used for:
    # - inspecting DB
    # - debugging tasks
    # - manual edits
    path("admin/", admin.site.urls),
    # Async AI task submission endpoint.
    # Main distributed AI pipeline entrypoint.
    # Flow: Client → /api/submit → submit_task → Kafka → Consumer → Celery → Worker
    # Method: POST
    # Body: JSON
    # Returns: {"status": "queued"}
    path("api/submit", submit_task),
    path("api/health/", include("health.urls")),
]
