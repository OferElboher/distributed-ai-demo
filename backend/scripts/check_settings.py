from django.conf import settings

env = settings.ENVIRONMENT

if env == "dev":
    assert settings.DEBUG is True
else:
    assert settings.DEBUG is False

assert isinstance(settings.ALLOWED_HOSTS, list)

print(f"{env}: OK")
