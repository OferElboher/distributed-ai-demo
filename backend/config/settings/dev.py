# As a standard practice for Django settings modules, prevent the Ruff linter from issuing the too strict "F403 `from <module-name> import *` used; unable to detect undefined names".
# ruff: noqa: F403

from .base import *

DEBUG = True

ALLOWED_HOSTS = ["*"]
