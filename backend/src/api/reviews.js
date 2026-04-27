///////////////////////////////////////////////////////////////////////////////
// Queue used to trigger asynchronous analysis
///////////////////////////////////////////////////////////////////////////////

/**
 * Review analysis queue (Redis-backed via BullMQ).
 *
 * Responsibility:
 * - receives jobs from API layer
 * - forwards them to worker process asynchronously
 */
const reviewQueue = require("../queue/reviewQueue");

///////////////////////////////////////////////////////////////////////////////
// Core Imports
///////////////////////////////////////////////////////////////////////////////

/**
 * Express framework used for routing HTTP requests.
 */
const express = require("express");
const router = express.Router();

/**
 * Mongoose model representing a review document in MongoDB.
 */
const Review = require("../models/Review");

///////////////////////////////////////////////////////////////////////////////
// Review API Routes
///////////////////////////////////////////////////////////////////////////////

/**
 * This module defines all API endpoints related to:
 * - creating reviews
 * - retrieving review status and results
 *
 * Acts as the HTTP interface layer between:
 * frontend → backend → queue/worker system
 */

///////////////////////////////////////////////////////////////////////////////
// Create Review
///////////////////////////////////////////////////////////////////////////////

/**
 * POST /reviews
 *
 * Creates a new email review and triggers asynchronous analysis.
 *
 * Processing flow:
 * 1. Receive raw email data from client
 * 2. Store it in MongoDB with status = "pending"
 * 3. Enqueue a background job for worker processing
 * 4. Return immediately without waiting for analysis
 *
 * This ensures the API remains fast and non-blocking.
 */
router.post("/", async (req, res) => {
  try {
    /**
     * Extract email payload from request body
     */
    const { senderName, senderEmail, subject, body, links, referenceSources } =
      req.body;

    /**
     * Persist review in database
     *
     * Stored as "pending" until worker processes it.
     * MongoDB write is asynchronous I/O operation.
     */
    const review = await Review.create({
      senderName,
      senderEmail,
      subject,
      body,
      links,
      referenceSources,
      status: "pending",
    });

    /**
     * Enqueue background analysis job
     *
     * Only the reviewId is passed to keep queue payload lightweight.
     * Worker will retrieve full document from MongoDB.
     */
    await reviewQueue.add("analyze", {
      reviewId: review._id.toString(),
    });

    /**
     * Immediate response to client
     *
     * Confirms review creation and returns initial state.
     */
    return res.status(201).json({
      id: review._id,
      status: review.status,
    });
  } catch (err) {
    /**
     * Error handling
     *
     * Logs internal server error and returns generic response.
     */
    console.error("Failed to create review:", err);

    return res.status(500).json({
      error: "Failed to create review",
    });
  }
});

///////////////////////////////////////////////////////////////////////////////
// Get All Reviews
///////////////////////////////////////////////////////////////////////////////

/**
 * GET /reviews
 *
 * Returns a lightweight list of all reviews.
 *
 * Intended use:
 * - dashboard overview
 * - scanning review statuses
 *
 * Does NOT return full analysis details to keep payload small.
 */
router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .select("senderEmail subject status analysisResult.verdict updatedAt");

    return res.json(reviews);
  } catch (err) {
    console.error("Failed to fetch reviews:", err);

    return res.status(500).json({
      error: "Failed to fetch reviews",
    });
  }
});

///////////////////////////////////////////////////////////////////////////////
// Get Single Review (Full Detail View)
///////////////////////////////////////////////////////////////////////////////

/**
 * GET /reviews/:id
 *
 * Returns complete review information for analyst inspection.
 *
 * Includes:
 * - original email content
 * - analysis result
 * - findings and evidence
 * - follow-up questions
 * - manual override (if present)
 *
 * This is the primary endpoint for detailed investigation view.
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    /**
     * Fetch full review document from MongoDB
     */
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        error: "Review not found",
      });
    }

    return res.json(review);
  } catch (err) {
    console.error("Failed to fetch review:", err);

    return res.status(500).json({
      error: "Failed to fetch review",
    });
  }
});

///////////////////////////////////////////////////////////////////////////////
// Export Router
///////////////////////////////////////////////////////////////////////////////

module.exports = router;
