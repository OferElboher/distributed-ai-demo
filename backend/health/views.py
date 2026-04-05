from django.http import JsonResponse
# from django.shortcuts import render


def health(request):
    # An initial trivial implementation.
    # May be expanded to check DBs, Redis, etc.
    return JsonResponse({"status": "ok"})
