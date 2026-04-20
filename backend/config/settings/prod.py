# As a standard practice for Django settings modules, prevent the Ruff linter from issuing the too strict "F403 `from <module-name> import *` used; unable to detect undefined names".
# ruff: noqa: F403

from .base import *

DEBUG = False

# With actual production version: Comment-in the following line, and replace in it <company-domain-url> with an actual URL (e.g., my-company.com).
# ALLOWED_HOSTS = ["<company-domain-url>"]
