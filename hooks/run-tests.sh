#!/bin/bash
# This script runs Django tests in the Docker backend container right before a git push, and it fails the push in case any test fails.

# ******************************************************************************************
# *** IMPORTANT:                                                                         ***
# *** This script must be made executable using the command: chmod +x hooks/run-tests.sh ***
# ******************************************************************************************


# Stop the execution of this script and exit immediately if any command fails.
set -e

# Ensure that the container is up-to-date; if it isn't, rebuild the container.
echo "Rebuilding the container..."
docker compose -f infra/docker/docker-compose.yml build backend

# Run tests inside backend container.
# NOTICE:
# - In order to prevent the following PostgreSQL issue:
#   - Django tries to create a test database called test_demo, but one already exists from a previous test run
#   - Because PostgreSQL does not allow duplicate database names, Django fails
#   - Therefore the pre-push hook fails and displays the followingerror message:
#     Got an error creating the test database: duplicate key value violates unique constraint "pg_database_datname_index"
#     DETAIL:  Key (datname)=(test_demo) already exists.
#   - The push operation is blocked
#   There are two options:
#   - Let Django drop the test DB automatically by modifying this script to drop any existing test DB before running tests:
#     docker compose -f infra/docker/docker-compose.yml exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS test_demo;"
#   - Use Django’s "--keepdb" flag, which tells Django to reuse the existing test DB instead of recreating it;
#     This option is preferred (see the "--keepdb" flag added in the end of the test-runner command right below);
#     That's because it:
#     - Speeds up tests and avoids the duplicate DB problem, that is, it -
#     - Avoids errors caused by leftover test databases (test_demo already exists).
#     - Makes the hook faster (Django reuses the test DB instead of dropping and recreating it every push)
#     - Is safer for local development and doesn’t require direct DB manipulation in the script.
# - In order to avoid leftover container issues:
#   - Use Docker's "--rm" flag, which starts a fresh container for tests, and removes it after the tests finish.
echo "Running Django tests in Docker backend..."
docker compose -f infra/docker/docker-compose.yml exec -T backend python manage.py test --verbosity 2 --keepdb
docker compose -f infra/docker/docker-compose.yml run --rm backend python manage.py test --verbosity 2 --keepdb

# Note:
# - There is no need to capture the tests' exit code and examine it using the below commented-out code in order to explicitly block the push operation in case any test failed;
#   That's because of the "set -e" command above, which is causing any test failure to automatically stop the script and propagate the failure to pre-commit, which will block the push.
# - Parameter "$?":
#   - Expands to the exit status (or return code) of the last executed foreground command or pipeline
#   - Shall be zero in case all the tests succeeded, and 1 in case any test failed
#   - Used for error handling and conditional logic in shell scripts
# TEST_EXIT_CODE=$?
# if [ $TEST_EXIT_CODE -ne 0 ]; then
#     echo "ERROR: Django tests failed - push aborted."
#     exit 1
# fi

echo "All tests passed - proceeding with push."
exit 0
