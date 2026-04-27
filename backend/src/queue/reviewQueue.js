///////////////////////////////////////////////////////////////////////////////
// Review Queue (BullMQ)
///////////////////////////////////////////////////////////////////////////////

/**
 * This module defines the queue responsible for handling asynchronous
 * email analysis jobs.
 *
 * Instead of processing analysis inside the API request (which would block
 * the server), jobs are pushed into this queue and processed later by a worker.
 */

const { Queue } = require("bullmq");
const IORedis = require("ioredis");

///////////////////////////////////////////////////////////////////////////////
// Redis Connection Configuration
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates a connection to the Redis server.
 *
 * Redis acts as the message broker between:
 * - the API (producer of jobs)
 * - the worker (consumer of jobs)
 *
 * Connection is configured for local development:
 * - host: localhost (127.0.0.1)
 * - port: default Redis port (6379)
 */
const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
});

///////////////////////////////////////////////////////////////////////////////
// Queue Definition
///////////////////////////////////////////////////////////////////////////////

/**
 * Defines a queue named "review-analysis".
 *
 * This queue will hold jobs representing email reviews that need analysis.
 *
 * Each job added to this queue will later be picked up by a worker process.
 */
const reviewQueue = new Queue("review-analysis", {
  connection,
});

///////////////////////////////////////////////////////////////////////////////
// Export Queue Instance
///////////////////////////////////////////////////////////////////////////////

/**
 * Exporting the queue allows other parts of the system (e.g., API routes)
 * to add jobs for asynchronous processing.
 */
module.exports = reviewQueue;