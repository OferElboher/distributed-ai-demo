/**
 * Worker entrypoint (service boundary file)
 *
 * This file is the stable entrypoint for the background worker service.
 *
 * It exists to decouple Docker/runtime configuration from internal worker
 * implementation details.
 *
 * WHY THIS FILE EXISTS:
 * - Prevents Docker from depending on deep internal paths
 * - Allows refactoring worker implementation without changing Dockerfiles
 * - Provides a single canonical entrypoint for the worker service
 *
 * ACTUAL IMPLEMENTATION:
 * The real worker logic lives in:
 *   ./worker/reviewWorker.js
 *
 * This file simply delegates execution to it.
 */
require("./worker/reviewWorker");
