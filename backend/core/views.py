"""
REST API views.

Role in system
--------------
Entry point of distributed AI pipeline.

Flow
----
Client → REST API → Kafka Producer → Kafka → Consumer → Celery → AI Worker → DB

Responsibilities
---------------
- Accept HTTP requests
- Validate input
- Publish Kafka events
- Return immediate response

This layer performs NO AI processing.
It only queues work asynchronously.
"""

import json
from typing import Dict, Any

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from core.kafka_producer import send_task


@csrf_exempt
def submit_task(request):
    """
    Submit AI task to distributed processing pipeline.

    Role in system
    --------------
    Main REST entrypoint for asynchronous AI processing.

    Flow
    ----
    Client → HTTP POST → submit_task()
           → send_task()
           → Kafka
           → Consumer
           → Celery
           → Worker

    Request
    -------
    POST /api/submit

    Body (JSON)
    -----------
    {
        "task": "analyze_text",
        "text": "hello world"
    }

    Behavior
    --------
    - Parses incoming JSON request
    - Sends task to Kafka
    - Returns immediately

    Returns
    -------
    JsonResponse

    Example response
    ----------------
    {
        "status": "queued"
    }

    Notes
    -----
    This endpoint does NOT wait for AI processing.
    It only enqueues the task asynchronously.
    """

    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=405)

    try:
        data: Dict[str, Any] = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    # Send to Kafka
    send_task(data)

    return JsonResponse({"status": "queued"})
