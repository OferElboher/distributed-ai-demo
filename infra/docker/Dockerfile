# Use official lightweight Python image.
# "slim" keeps image small while still Debian-based (easy debugging).
FROM python:3.12-slim


# Prevent Python from writing .pyc files.
# Keeps container filesystem cleaner.
ENV PYTHONDONTWRITEBYTECODE=1


# Force stdout/stderr to be unbuffered.
# Required for real-time Docker logs, because without it, Python buffers output, so that:
# - It waits until the first of the following occurs: buffer fills, program exits, newline flush, random timing.
# - Log message does NOT immediately appear in Docker logs, but rather appear late or in chunks.
ENV PYTHONUNBUFFERED=1


# Set working directory inside container.
# All following commands run from /app.
WORKDIR /app


# Install system dependencies.
# build-essential needed for compiling Python packages (psycopg2, etc.)
# curl useful for debugging & health checks.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       curl \
    && rm -rf /var/lib/apt/lists/*


# # Copy dependency file first.
# # This allows Docker layer caching:
# # Dependencies won't reinstall unless requirements.txt changes.
# # Notice: This should be commented-out in case of a repo that uses Poetry, which gets the dependencies from <pyproject.toml> and <poetry.lock>, and not from <requirements.txt>.
# COPY requirements.txt .


# Install Python dependencies.
# Parameter "--no-cache-dir" reduces image size.
# Notice: This should be suited according to whether the repo uses Poetry, which gets the dependencies from <pyproject.toml> and <poetry.lock>, and not from <requirements.txt>.
# In case:
# - <requirements.txt> is used:
# RUN pip install --no-cache-dir -r requirements.txt
# - Poetry is used:
#   - Copy dependency definitions.
COPY pyproject.toml poetry.lock ./
#   - Install Poetry,
RUN pip install poetry
#   - Install dependencies.
RUN poetry config virtualenvs.create false && poetry install --no-interaction --no-ansi

# Copy entire project into container.
# Done AFTER installing dependencies for caching efficiency.
# Notice: This must suit the current context (see services.backend.build.context in <infra/docker/docker-compose.yml>).
COPY . .


# Expose port used by Django / Gunicorn.
# This is documentation only (not publishing).
EXPOSE 8000


# Default command.
# Can be overridden by docker-compose service "command".
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
