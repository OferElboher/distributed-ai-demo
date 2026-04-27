///////////////////////////////////////////////////////////////////////////////
// Review Worker (Queue Consumer)
///////////////////////////////////////////////////////////////////////////////

/**
 * This worker is responsible for consuming jobs from the "review-analysis" queue,
 * that's defined in <backend/src/queue/reviewQueue.js>.
 *
 * Architecture role:
 * - API layer enqueues review analysis jobs into Redis
 * - Worker processes these jobs asynchronously
 * - Worker updates MongoDB with analysis results
 *
 * This separation ensures:
 * - API remains fast and non-blocking
 * - Heavy processing is offloaded to background workers
 */

const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const Review = require("../models/Review");

///////////////////////////////////////////////////////////////////////////////
// Redis Connection
///////////////////////////////////////////////////////////////////////////////

/**
 * Redis client used by both queue and worker.
 *
 * Redis acts as the job broker between:
 * - Producer (API)
 * - Consumer (Worker)
 *
 * Requirements:
 * - Must use same host/port as API queue
 * - maxRetriesPerRequest must be null due to BullMQ blocking operations
 *   (BullMQ uses long-lived blocking Redis commands to wait for jobs.
 *    If maxRetriesPerRequest isn't null, ioredis (the Node.js client library
 *    for communicating with a Redis server, and lets the application read/
 *    write data and use Redis features like queues, caching, and pub/sub)
 *    retries requests automatically, and it can interrupt or duplicate these
 *    blocking operations and break job processing. Setting it to null disables
 *    automatic retries so BullMQ can safely control reliability at the job
 *    level instead.)
 */
const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

///////////////////////////////////////////////////////////////////////////////
// MongoDB Connection + Worker Startup
///////////////////////////////////////////////////////////////////////////////

/**
 * Establish MongoDB connection before starting worker.
 *
 * Reason:
 * - Worker depends on MongoDB for reading/updating review documents
 * - Prevents processing jobs without database availability
 */
mongoose
  .connect("mongodb://localhost:27018/triage")
  .then(() => {
    console.log("Worker connected to MongoDB");

    /**
     * Worker Initialization
     *
     * This worker listens to "review-analysis" queue and processes jobs.
     */
    const worker = new Worker(
      "review-analysis",

      /**
       * Job Processor Function
       *
       * Each job contains:
       * - reviewId: reference to MongoDB document
       *   (See <backend/src/api/reviews.js>, reviewQueue.add("analyze"...).)
       *
       * Processing steps:
       * 1. Load review from database
       * 2. Mark as processing
       * 3. Perform analysis
       * 4. Store result in database
       * 5. Mark as completed
       */
      async (job) => {
        const { reviewId } = job.data;

        console.log(`Processing review: ${reviewId}`);

        /**
         * Load review document from MongoDB Review collection
         */
        const review = await Review.findById(reviewId);

        if (!review) {
          throw new Error(`Review not found: ${reviewId}`);
        }

        /**
         * Update status to indicate processing has started
         */
        review.status = "processing";
        await review.save();

        /**
         * Simulated AI + rule-based analysis result
         *
         * (This will later be replaced with:
         *  - LLM inference
         *  - deterministic rule engine
         *  - hybrid scoring logic)
         */
        const result = {
          verdict: "suspicious",
          recommendedAction: "investigate",
          summary: "Email contains urgent language and external link.",
          findings: [
            {
              severity: "high",
              explanation: "Urgency-based social engineering pattern detected",
              evidence: review.body.slice(0, 120),
            },
          ],
          followUpQuestions: [
            "Was this email expected?",
            "Did you recently request a password reset?",
          ],
        };

        /**
         * Persist analysis results
         */
        review.analysisResult = result;
        review.status = "completed";

        await review.save();

        console.log(`Completed review: ${reviewId}`);
      },

      /**
       * Worker connection configuration
       */
      { connection },
    );

    /**
     * Error handling for failed jobs
     *
     * Triggered when:
     * - job throws an exception
     * - processing fails unexpectedly
     */
    worker.on("failed", (job, err) => {
      console.error("Job failed:", err);
    });
  })

  /**
   * MongoDB connection failure handling
   *
   * If DB connection fails:
   * - Worker cannot function correctly
   * - Process exits to avoid running in invalid state
   */
  .catch((err) => {
    console.error("❌ MongoDB connection error (worker):", err);
    process.exit(1);
  });
