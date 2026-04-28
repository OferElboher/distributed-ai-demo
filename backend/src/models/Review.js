///////////////////////////////////////////////////////////////////////////////
// Review Model
///////////////////////////////////////////////////////////////////////////////

/**
 * Mongoose schema for email review analysis.
 * Stores raw email input, analysis results, and analyst overrides.
 */

const mongoose = require("mongoose");

///////////////////////////////////////////////////////////////////////////////
// Reference Sub-Schemas
///////////////////////////////////////////////////////////////////////////////

/**
 * Individual finding produced by AI or rule engine
 */
const FindingSchema = new mongoose.Schema(
  {
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    explanation: {
      type: String,
      required: true,
    },
    evidence: {
      type: String,
      required: false,
    },
  },
  { _id: false }
);

/**
 * Reference material (trusted domains, guidelines, etc.)
 */
const ReferenceSourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "url"],
      required: true,
    },
    title: String,
    content: String,
  },
  { _id: false }
);

///////////////////////////////////////////////////////////////////////////////
// Main Schema
///////////////////////////////////////////////////////////////////////////////

const ReviewSchema = new mongoose.Schema(
  {
    ///////////////////////////////////////////////////////////////////////////
    // Email Metadata
    ///////////////////////////////////////////////////////////////////////////

    senderName: {
      type: String,
      required: true,
    },

    senderEmail: {
      type: String,
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
    },

    body: {
      type: String,
      required: true,
    },

    links: {
      type: [String],
      default: [],
    },

    referenceSources: {
      type: [ReferenceSourceSchema],
      default: [],
    },

    override: {
      verdict: String,
      recommendedAction: String,
      reason: String,
      timestamp: Date,
    },

    ///////////////////////////////////////////////////////////////////////////
    // Processing State
    ///////////////////////////////////////////////////////////////////////////

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    ///////////////////////////////////////////////////////////////////////////
    // AI + Rule-Based Output
    ///////////////////////////////////////////////////////////////////////////

    analysisResult: {
      verdict: {
        type: String,
        enum: ["benign", "suspicious", "likely_phishing"],
      },

      recommendedAction: {
        type: String,
        enum: ["close", "investigate", "report_and_block"],
      },

      summary: String,

      findings: {
        type: [FindingSchema],
        default: [],
      },

      followUpQuestions: {
        type: [String],
        default: [],
      },
    },

    ///////////////////////////////////////////////////////////////////////////
    // Analyst Override
    ///////////////////////////////////////////////////////////////////////////

    override: {
      verdict: {
        type: String,
        enum: ["benign", "suspicious", "likely_phishing"],
      },

      recommendedAction: {
        type: String,
        enum: ["close", "investigate", "report_and_block"],
      },

      reason: String,
    },
  },

  /////////////////////////////////////////////////////////////////////////////
  // Timestamps
  /////////////////////////////////////////////////////////////////////////////

  {
    timestamps: true,
  }
);

///////////////////////////////////////////////////////////////////////////////
// Export Model
///////////////////////////////////////////////////////////////////////////////

/**
 * Allow to create, read, update, and delete review documents in the database.
 */
module.exports = mongoose.model("Review", ReviewSchema);

