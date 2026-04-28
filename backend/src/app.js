///////////////////////////////////////////////////////////////////////////////
// Core Framework
///////////////////////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();


///////////////////////////////////////////////////////////////////////////////
// Models
///////////////////////////////////////////////////////////////////////////////

const Review = require("./models/Review");


///////////////////////////////////////////////////////////////////////////////
// Queue (BullMQ Producer)
///////////////////////////////////////////////////////////////////////////////

/**
 * Redis-backed job queue for async review processing
 * (must match worker queue name: "review-analysis")
 */
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

const reviewQueue = new Queue("review-analysis", { connection });


///////////////////////////////////////////////////////////////////////////////
// Application Initialization
///////////////////////////////////////////////////////////////////////////////

const app = express();


///////////////////////////////////////////////////////////////////////////////
// Middleware Configuration
///////////////////////////////////////////////////////////////////////////////

app.use(cors());
app.use(express.json());


///////////////////////////////////////////////////////////////////////////////
// Routes
///////////////////////////////////////////////////////////////////////////////

// Request "/reviews", which does "Get All Paginated Reviews",
// is routed to <backend/src/api/reviews.js>.
const reviewRoutes = require("./api/reviews");
app.use("/reviews", reviewRoutes);


/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});


///////////////////////////////////////////////////////////////////////////////
// Test Endpoint (End-to-End Pipeline Trigger)
///////////////////////////////////////////////////////////////////////////////

/**
 * Flow:
 * frontend → API → MongoDB → BullMQ → worker → analysis update
 */
app.post("/test", async (req, res) => {
  console.log("TEST HIT:", req.body);

  // 1. Create review in MongoDB
  const review = await Review.create({
    body: req.body.message,
    subject: "demo subject",
    senderEmail: "demo@example.com",
    senderName: "demo user",
    status: "pending",
    createdAt: new Date(),
  });

  // 2. Push job to queue for async processing
  await reviewQueue.add("analyze", {
    reviewId: review._id.toString(),
  });

  res.json({
    ok: true,
    reviewId: review._id,
  });
});


///////////////////////////////////////////////////////////////////////////////
// Get Single Review (Structured Result Fetch Endpoint)
///////////////////////////////////////////////////////////////////////////////

/**
 * GET /reviews/:id
 *
 * Purpose:
 * Retrieves a full review document from MongoDB, including:
 * - original email content
 * - current processing status
 * - analysis result (if available)
 *
 * This endpoint is required for the frontend to:
 * - display structured triage results
 * - refresh analysis state asynchronously
 *
 * ARCHITECTURE ROLE:
 * Frontend
 *   → calls this endpoint after submission
 *   → fetches updated review state from DB
 *   → displays verdict, findings, and recommendations
 *
 * This completes the "read-after-async-process" pattern
 * required for background job systems.
 */
app.get("/reviews/:id", async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(review);
});


///////////////////////////////////////////////////////////////////////////////
// Manual Override Endpoint (Analyst Control Layer)
///////////////////////////////////////////////////////////////////////////////

/**
 * POST /reviews/:id/override
 *
 * Allows an analyst to override system-generated triage results.
 *
 * Stores:
 * - original analysis result (preserved automatically in DB document)
 * - overridden verdict or action
 * - analyst-provided reason
 */
app.post("/reviews/:id/override", async (req, res) => {
  const { verdict, recommendedAction, reason } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    return res.status(404).json({ error: "Not found" });
  }

  review.override = {
    verdict,
    recommendedAction,
    reason,
    timestamp: new Date()
  };

  await review.save();

  res.json({ ok: true, review });
});


///////////////////////////////////////////////////////////////////////////////
// Database Connection
///////////////////////////////////////////////////////////////////////////////

mongoose
  .connect("mongodb://localhost:27018/triage")
  .then(() => console.log("MongoDB connection established"))
  .catch((err) => console.error("MongoDB connection error:", err));


///////////////////////////////////////////////////////////////////////////////
// Server Startup
///////////////////////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


///////////////////////////////////////////////////////////////////////////////
// TBD - Planned Features
///////////////////////////////////////////////////////////////////////////////

/**
 * AI analysis service integration
 * - phishing detection
 * - summarization
 */

/**
 * Rule engine
 * - credential detection
 * - urgency detection
 */

/**
 * Audit trail + analyst override system
 */
