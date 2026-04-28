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
// Pagination Contract Binding
///////////////////////////////////////////////////////////////////////////////

/**
 * IMPORTANT ARCHITECTURAL RULE:
 *
 * The backend MUST NOT define its own pagination size independently.
 *
 * Instead, it consumes the shared configuration, REVIEW_PAGE_SIZE.
 *
 * This ensures:
 * - frontend and backend always stay in sync
 * - no hidden divergence in pagination behavior
 * - single source of truth for page size across the system
 *
 * This value is defined in:
 * shared/config/pagination.js
 */
const { REVIEW_PAGE_SIZE } = require("../../../shared/config/pagination");

const DEFAULT_PAGE = 0;
const DEFAULT_LIMIT = REVIEW_PAGE_SIZE;


///////////////////////////////////////////////////////////////////////////////
// Utility: Link Extraction (ADDED - REQUIRED FOR RULE ENGINE)
///////////////////////////////////////////////////////////////////////////////

/**
 * Extracts HTTP/HTTPS links from email body text.
 *
 * This is required for:
 * - domain mismatch detection (worker rule)
 * - phishing detection heuristics
 * - external link analysis
 *
 * Without this, rule-based security checks cannot function correctly.
 */
const extractLinks = (text) => {
  const regex = /(https?:\/\/[^\s]+)/g;
  return text.match(regex) || [];
};

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
 * 2. Extract links from email body (used by security rules)
 * 3. Store review in MongoDB with status = "pending"
 * 4. Enqueue background job for worker processing
 * 5. Return immediately without waiting for analysis
 *
 * This ensures:
 * - API remains fast
 * - analysis is fully asynchronous
 * - system scales under load
 */
router.post("/", async (req, res) => {
  try {
    /**
     * Extract email payload from request body
     */
    const {
      senderName,
      senderEmail,
      subject,
      body,
      referenceSources,
    } = req.body;

    /**
     * Extract links for later rule-based analysis
     */
    const links = extractLinks(body);

    /**
     * Persist review in database
     *
     * Stored as "pending" until worker processes it.
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
     * Only reviewId is passed for lightweight queue payload.
     */
    await reviewQueue.add("analyze", {
      reviewId: review._id.toString(),
    });

    /**
     * Immediate response to client
     */
    return res.status(201).json({
      id: review._id,
      status: review.status,
    });
  } catch (err) {
    console.error("Failed to create review:", err);

    return res.status(500).json({
      error: "Failed to create review",
    });
  }
});

///////////////////////////////////////////////////////////////////////////////
// Get All Paginated Reviews
///////////////////////////////////////////////////////////////////////////////

/**
 * GET /reviews
 *
 * Returns a lightweight, paginated list of reviews.
 *
 * Intended use:
 * - dashboard overview
 * - quick scanning of review statuses
 * - scalable handling of large datasets (thousands/millions of reviews)
 *
 * Query Parameters:
 * - page: zero-based page index (default: above defined DEFAULT_PAGE)
 * - limit: number of items per page (default: above defined DEFAULT_LIMIT)
 *
 * Behavior:
 * - results are sorted by most recently updated (updatedAt descending)
 * - pagination is applied using skip + limit
 * - only minimal fields are returned to reduce payload size
 *
 * Returned fields:
 * - senderEmail
 * - subject
 * - status
 * - analysisResult.verdict
 * - updatedAt
 */
router.get("/", async (req, res) => {
  try {
    /**
     * Extract pagination parameters from query string
     */
    const page = parseInt(req.query.page ?? DEFAULT_PAGE);
    const limit = parseInt(req.query.limit ?? DEFAULT_LIMIT);

    /**
     * Enforce pagination safety
     */
    const safePage = Math.max(page, 0);
    const safeLimit = Math.min(
      Math.max(limit, 1),
      REVIEW_PAGE_SIZE
    );

    const total = await Review.countDocuments();

    /**
     * Query MongoDB with pagination and field selection
     */
    const reviews = await Review.find()
      .sort({ updatedAt: -1 })
      .skip(safePage * safeLimit)
      .limit(safeLimit)
      .select("senderEmail subject status analysisResult.verdict updatedAt");

    return res.json({
      data: reviews,
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit + reviews.length < total,
    });
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
 * This endpoint supports full investigation workflow.
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
