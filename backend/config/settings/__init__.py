# As a standard practice for Django settings modules, prevent the Ruff linter from issuing the too strict "F403 `from <module-name> import *` used; unable to detect undefined names".
# ruff: noqa: F403

import os

env = os.getenv("ENVIRONMENT", "dev")

if env == "prod":
    from .prod import *
elif env == "staging":
    from .staging import *
else:
    from .dev import *
