///////////////////////////////////////////////////////////////////////////////
// Core Framework
///////////////////////////////////////////////////////////////////////////////

/**
 * Express framework for HTTP server and routing
 * (provides robust tools for routing, handling HTTP requests, and managing middleware)
 */
const express = require("express");

/**
 * CORS middleware to allow frontend communication
 * (CORS (Cross-Origin Resource Sharing) relaxes the browser's Same-Origin Policy (SOP)
 * by setting HTTP headers that allow or restrict web browsers from making server requests
 * from a different domain, domain port, or protocol)
 */
const cors = require("cors");

/**
 * MongoDB object modeling via Mongoose
 * (stores nested, evolving JSON-like data structures directly in a single document,
 * avoiding the need for table joins and making complex records like email analysis
 * results easier to read and write)
 */
const mongoose = require("mongoose");

/**
 * Environment variable loader (.env support)
 */
require("dotenv").config();


///////////////////////////////////////////////////////////////////////////////
// Application Initialization
///////////////////////////////////////////////////////////////////////////////

/**
 * Express application instance
 */
const app = express();


///////////////////////////////////////////////////////////////////////////////
// Middleware Configuration
///////////////////////////////////////////////////////////////////////////////

/**
 * Enables Cross-Origin Resource Sharing
 * (required for React frontend integration)
 */
app.use(cors());

/**
 * Parses incoming JSON payloads
 */
app.use(express.json());


///////////////////////////////////////////////////////////////////////////////
// API Routes Registration
///////////////////////////////////////////////////////////////////////////////

/**
 * Imports the review route module.
 * This module contains all endpoints related to creating and managing email reviews.
 * Import it for the API routes to exist inside the application.
 */
const reviewRoutes = require("./api/reviews");

/**
 * Registers/mounts the review routes under the "/reviews" URL path.
 * Attaches the requests defined in the review API module to the main Express app.
 */
app.use("/reviews", reviewRoutes);


///////////////////////////////////////////////////////////////////////////////
// Health Check Endpoint
///////////////////////////////////////////////////////////////////////////////

/**
 * Basic service health endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});


///////////////////////////////////////////////////////////////////////////////
// Database Connection
///////////////////////////////////////////////////////////////////////////////

/**
 * MongoDB connection setup
 * (create the triage DB; password authentication is not enabled in this setup)
 */
mongoose
  .connect("mongodb://localhost:27018/triage")
  .then(() => console.log("MongoDB connection established"))
  .catch((err) => console.error("MongoDB connection error:", err));


///////////////////////////////////////////////////////////////////////////////
// Server Configuration
///////////////////////////////////////////////////////////////////////////////

/**
 * Application port configuration
 */
const PORT = process.env.PORT || 3000;

// Test endpoint for end-to-end verification (frontend → backend → request parsing)
// Used in demo to confirm API receives and returns JSON correctly
app.post("/test", (req, res) => {
  console.log("TEST HIT:", req.body);
  res.json({ ok: true, received: req.body });
});

/**
 * Starts HTTP server
 */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


///////////////////////////////////////////////////////////////////////////////
// TDB - Planned Features (Not Implemented Yet)
///////////////////////////////////////////////////////////////////////////////

/**
 * TDB: Review API routes
 * - POST /reviews
 * - GET /reviews
 * - GET /reviews/:id
 */

/**
 * TDB: Background job queue integration (BullMQ)
 * - async email analysis pipeline
 */

/**
 * TDB: AI analysis service integration
 * - summarization
 * - phishing detection reasoning
 * - follow-up questions generation
 */

/**
 * TDB: Deterministic rule engine
 * - credential request detection
 * - domain mismatch checks
 * - urgency pattern detection
 */

/**
 * TDB: Manual override system
 * - analyst verdict override
 * - audit trail storage
 */
