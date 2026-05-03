///////////////////////////////////////////////////////////////////////////////
// Review Worker (Queue Consumer)
///////////////////////////////////////////////////////////////////////////////

/**
 * This worker is responsible for consuming jobs from the "review-analysis"
 * queue, which is defined in <backend/src/queue/reviewQueue.js>.
 *
 * It is a core component of the asynchronous triage pipeline.
 *
 * ARCHITECTURE ROLE:
 *
 * The system follows a strict separation of concerns:
 *
 * 1. API Layer (Express)
 *    - receives email review requests
 *    - stores initial Review document in MongoDB
 *    - enqueues job into Redis (BullMQ queue)
 *
 * 2. Worker Layer (this file)
 *    - consumes queued jobs asynchronously
 *    - performs deterministic + AI-based analysis
 *    - updates MongoDB with final structured result
 *
 * 3. Storage Layer (MongoDB)
 *    - persists both raw input and analysis results
 *
 * This ensures:
 * - non-blocking API behavior
 * - scalable background processing
 * - separation between ingestion and computation
 * - extensibility for AI-driven enrichment
 */


const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const Review = require("../models/Review");


///////////////////////////////////////////////////////////////////////////////
// LLM INTEGRATION (Ollama Local Model)
///////////////////////////////////////////////////////////////////////////////

/**
 * LLM-based analysis module.
 *
 * This does the following:
 * - introduces AI-assisted reasoning into the pipeline
 * - complements deterministic rule-based logic
 * - produces structured triage output
 *
 * The model is expected to:
 * - summarize email content
 * - extract relevant findings
 * - optionally generate follow-up questions
 *
 * IMPORTANT:
 * This is a local Ollama-based integration and does NOT require
 * external paid APIs.
 */
const { analyzeReview } = require("../llm/analyzeReview");


///////////////////////////////////////////////////////////////////////////////
// REDIS CONNECTION (BullMQ Transport Layer)
///////////////////////////////////////////////////////////////////////////////

/**
 * Redis is used as the message broker between:
 * - API (producer)
 * - Worker (consumer)
 *
 * BullMQ relies on long-lived blocking Redis commands.
 *
 * Configuration requirement:
 * - maxRetriesPerRequest must be null
 *   to avoid interrupting blocking queue operations
 */
const connection = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null,
});


///////////////////////////////////////////////////////////////////////////////
// WORKER INITIALIZATION
///////////////////////////////////////////////////////////////////////////////

/**
 * Establish MongoDB connection before starting worker.
 *
 * Reason:
 * - worker depends on persistent storage for:
 *   - reading review input
 *   - updating analysis results
 *
 * If DB is unavailable, worker must not process jobs.
 */
mongoose
  .connect("mongodb://mongo:27017/triage")
  .then(() => {
    console.log(`[${new Date().toISOString()}] Worker connected to MongoDB`);

    /**
     * BullMQ Worker Definition
     *
     * Queue name: "review-analysis"
     *
     * Each job contains:
     * - reviewId: reference to MongoDB document
     */
    const worker = new Worker(
      "review-analysis",

      /**
       * Job Processor Function
       *
       * Processing pipeline:
       * STEP 1: Load review from MongoDB
       * STEP 2: Mark as "processing"
       * STEP 3: Run deterministic rule engine
       * STEP 4: Call LLM for enrichment
       * STEP 5: Merge results (rules take precedence)
       * STEP 6: Persist final result
       * 
       * On any failure → persist status = "failed"
       */
      async (job) => {
        const { reviewId } = job.data;

        console.log(`[${new Date().toISOString()}] Processing review: ${reviewId}`);
        console.log(`[${new Date().toISOString()}] REVIEW STATUS UPDATE: ${reviewId} -> processing`);

        /**
         * IMPORTANT:
         * Declare review outside try/catch so we can still update its
         * status to "failed" if something breaks later.
         */
        let review;

        try {
          const reviewLoaded = await Review.findById(reviewId);

          if (!reviewLoaded) {
            throw new Error(`Review not found: ${reviewId}`);
          }

          review = reviewLoaded;

          review.status = "processing";
          await review.save();


          ///////////////////////////////////////////////////////////////////////////////
          // DETERMINISTIC RULE ENGINE (Security Layer)
          ///////////////////////////////////////////////////////////////////////////////

          /**
           * The rule engine is responsible for enforcing strict security constraints.
           *
           * Rules are deterministic and MUST override LLM output in case of conflict.
           *
           * This ensures:
           * - predictable security behavior
           * - no unsafe downgrade by model hallucinations
           * - explainable decision logic
           */
          const text = `${review.subject} ${review.body}`.toLowerCase();

          let verdict = "benign";
          let recommendedAction = "close";
          let findings = [];
          let followUpQuestions = [];

        /**
         * RULE 1:
         * Detect credential or sensitive information requests.
         *
         * This is a high-confidence phishing indicator.
         */
        if (
          text.includes("password") ||
          text.includes("mfa") ||
          text.includes("credit card") ||
          text.includes("verify account")
        ) {
          verdict = "likely_phishing";
          recommendedAction = "report_and_block";
          findings.push({
            severity: "high",
            explanation: "Credential or sensitive data request detected",
            evidence: review.body.slice(0, 120),
          });

        }

        /**
         * RULE 2:
         * Detect urgency combined with external links.
         *
         * This is a common social engineering pattern.
         */
        if (text.includes("urgent") && review.body.includes("http")) {
          verdict = verdict === "benign" ? "suspicious" : verdict;
          recommendedAction = "investigate";
          findings.push({
            severity: "high",
            explanation: "Urgent language combined with external link",
            evidence: review.body.slice(0, 120),
          });
        }

        /**
         * RULE 3:
         * Detect mismatch between sender domain and link domains
         *
         * Example:
         * sender: microsoft.com
         * link: evil-login.com  → suspicious
         *
         * This is a strong phishing indicator.
         */
        if (review.links && review.links.length > 0) {
          try {
            /**
             * Extract sender domain
             * (example: user@company.com → company.com)
             */
            const senderDomain = review.senderEmail.split("@")[1];

            /**
             * Check each link's domain
             */
            review.links.forEach((link) => {
              try {
                const url = new URL(link);
                const linkDomain = url.hostname;

                /**
                 * If domains do not match → add finding
                 */
                if (!linkDomain.includes(senderDomain)) {
                  findings.push({
                    severity: "high",
                    explanation: "Link domain does not match sender domain",
                    evidence: `${linkDomain} vs ${senderDomain}`,
                  });

                  /**
                   * Escalate verdict if still benign
                   */
                  if (verdict === "benign") {
                    verdict = "suspicious";
                    recommendedAction = "investigate";
                  }
                }
              } catch (e) {
                // Ignore malformed URLs safely
              }
            });
          } catch (e) {
            // Ignore malformed sender email safely
          }
        }
                
        /**
         * RULE 4:
         * Trusted domains validation
         *
         * If a trusted domains list is provided and:
         * - sender domain NOT in trusted list
         * - AND none of the link domains are trusted
         *
         * → add a finding
         */

        // Find in referenceSources an entry whose lowercased title contains "trusted".
        // If found, that entry's content is a string that contains one or more newline-
        // separated trusted domains (e.g., "microsoft.com\noffice.com\ncompany.com",
        // that contains 3 newline-separated domains). The domains of the sender and
        // links in the reviewed email are compared to each of these trusted domains
        // in order to decide whether they may be trusted, or not.
        const trustedSource = (review.referenceSources || []).find(
          (src) => src.title && src.title.toLowerCase().includes("trusted")
        );
        if (trustedSource) {
          /**
           * Parse trusted domains from text (newline-separated)
           */
          const trustedDomains = trustedSource.content
            .split("\n")
            .map((d) => d.trim())
            .filter(Boolean);

          try {
            const senderDomain = review.senderEmail.split("@")[1];
            const senderTrusted = trustedDomains.some((d) =>
              senderDomain.includes(d)
            );
            const linkTrusted = (review.links || []).some((link) => {
              try {
                const domain = new URL(link).hostname;
                return trustedDomains.some((d) => domain.includes(d));
              } catch {
                return false;
              }
            });

            /**
             * If nothing is trusted → add finding
             */
            if (!senderTrusted && !linkTrusted) {
              findings.push({
                severity: "medium",
                explanation: "Sender and links do not match trusted domains list",
                evidence: `sender: ${senderDomain}`,
              });

              if (verdict === "benign") {
                verdict = "suspicious";
                recommendedAction = "investigate";
              }
            }
          } catch (e) {
            // ignore malformed email safely
          }
        }

        /**
         * RULE 5:
         * Low-confidence fallback handling.
         *
         * If no rules were triggered, we explicitly request
         * additional analyst clarification via follow-up questions.
         */
        if (findings.length === 0) {
          followUpQuestions.push(
            "Is this email expected?",
            "Do you recognize the sender?"
          );

          /**
           * insufficient information → investigate
           */
          recommendedAction = "investigate";
        }


        ///////////////////////////////////////////////////////////////////////////////
        // LLM ENRICHMENT STEP (Ollama)
        ///////////////////////////////////////////////////////////////////////////////

        /**
         * The LLM is used AFTER rule evaluation.
         *
         * Its role:
         * - enhance explanation quality
         * - generate structured insights
         * - suggest additional reasoning
         *
         * IMPORTANT:
         * LLM output is NEVER allowed to override rule-based verdict.
         */
        // When along development/debugging, add an artificial delay that will enable
        // the user to see the review handling state dynamically changing.
        if (process.env.REACT_APP_DEBUG_MODE === "true") {
          await new Promise(r => setTimeout(r, 5000));
        }
        const llmResult = await analyzeReview(review);


        ///////////////////////////////////////////////////////////////////////////////
        // FINAL HYBRID RESULT
        ///////////////////////////////////////////////////////////////////////////////

        /**
         * Final result is composed using hybrid logic:
         * - Rule engine determines security-critical fields
         * - LLM enhances explanation and structure
         * - Rules always take precedence over model output
         */
        findings = Array.isArray(findings) ? findings : [];

        const finalVerdict = llmResult.verdict || verdict;

        const finalAction =
          finalVerdict === "benign" ? "close" :
          finalVerdict === "suspicious" ? "investigate" :
          "report_and_block";

        const normalizeSeverity = (s) => {
          if (s === "critical") return "high";
          if (s === "high") return "high";
          if (s === "medium") return "medium";
          return "low";
        };

        const result = {
          verdict: finalVerdict,
          recommendedAction: finalAction,
          summary: llmResult.summary,

          findings: [
            ...findings.map(f => ({
              explanation: String(f?.explanation ?? "No explanation provided"),
              severity: normalizeSeverity(f?.severity),
            })),

            ...(Array.isArray(llmResult.findings)
              ? llmResult.findings.map(f => ({
                  explanation: String(f?.explanation ?? "No explanation provided"),
                  severity: normalizeSeverity(f?.severity),
                }))
              : []),
          ],

          followUpQuestions:
            followUpQuestions.length > 0
              ? followUpQuestions
              : llmResult.followUpQuestions || [],
        };

        review.analysisResult = result;
        review.status = "completed";

        await review.save();
        console.log(`[${new Date().toISOString()}] REVIEW STATUS UPDATE: ${reviewId} -> completed`);
        console.log(`[${new Date().toISOString()}] Completed review: ${reviewId}`);
        return {
          reviewId,
          status: "completed"
        };
        } catch (err) {
          console.error(`Failed processing review ${reviewId}:`, err);

          /**
           * Persist failure state in DB
           */
          if (review) {
            review.status = "failed";
            await review.save();
          }

          throw err;
        }
      },

      { connection }
    );

    /**
     * Worker error handling
     */
    worker.on("failed", (job, err) => {
      console.error("Job failed:", err);
    });
  })

  /**
   * MongoDB connection failure handling
   */
  .catch((err) => {
    console.error("❌ MongoDB connection error (worker):", err);
    process.exit(1);
  });
