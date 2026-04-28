# ---------------------------------------------------------------------------
# DJANGO SETTINGS: DEV ENVIRONMENT
# ---------------------------------------------------------------------------
#
# This module is selected when ENVIRONMENT=dev (via CI, docker-compose, or local execution).
#
# IMPORT CHAIN
# ------------
# When this file is loaded, Django performs:
#   1. Import <backend.config.settings.dev>.
#   2. This file imports <backend.config.settings.base>.
#   3. <base.py> executes first (shared configuration).
#   4. Then <dev.py> overrides selected values below.
#
# WHEN THIS FILE IS USED
# ----------------------
# This settings module is active when:
# - Running local development server.
# - Running CI with "ENVIRONMENT=dev".
# - Running tests explicitly configured for dev environment.
#
# IMPORTANT BEHAVIOR
# ------------------
# Only ONE settings module is active per process: <dev.py> OR <staging.py> OR <prod.py>.
# <base.py> is always included underneath.
#
# PURPOSE OF THIS FILE
# --------------------
# - Enables debug mode for development.
# - Uses permissive host configuration.
# - Overrides only dev-specific settings.
#
# ---------------------------------------------------------------------------


# As a standard practice for Django settings modules, prevent the Ruff linter from issuing the too strict "F403 `from <module-name> import *` used; unable to detect undefined names".
# ruff: noqa: F403

from .base import *

DEBUG = False

ALLOWED_HOSTS = ["staging.local", "localhost"]
