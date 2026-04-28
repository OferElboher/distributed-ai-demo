///////////////////////////////////////////////////////////////////////////////
// LLM-Based Email Analysis (Ollama Integration Module)
///////////////////////////////////////////////////////////////////////////////

/**
 * This module is responsible for AI-assisted analysis of suspicious emails.
 *
 * For that purpose it:
 * - Uses a real LLM (local Ollama instance)
 * - Produces structured triage output
 * - Supports verdict, findings, and follow-up questions
 *
 * ROLE IN SYSTEM ARCHITECTURE:
 *
 * Worker
 *   → calls analyzeReview()
 *   → sends email content to LLM
 *   → receives structured JSON response
 *   → stores result in MongoDB (analysisResult)
 *
 * This ensures:
 * - separation between deterministic rules and AI reasoning
 * - pluggable model layer (can use Ollama alternatives)
 * - reproducible structured output for frontend display
 *
 * MODEL REQUIREMENTS:
 * - expects a locally running Ollama server
 * - model name is configurable (default: llama3)
 *
 * OUTPUT CONTRACT:
 * Must return JSON matching:
 * {
 *   verdict,
 *   recommendedAction,
 *   summary,
 *   findings[],
 *   followUpQuestions[]
 * }
 */

/**
 * Sends email content to local LLM (Ollama) for analysis.
 *
 * @param {Object} review - MongoDB review document
 * @returns {Object} structured analysis result
 */
async function analyzeReview(review) {
  const prompt = `
You are a cybersecurity analyst.

Analyze the following email and return STRICT JSON only.

Email:
Sender: ${review.senderEmail}
Subject: ${review.subject}
Body: ${review.body}

Return format:
{
  "verdict": "benign | suspicious | likely_phishing",
  "recommendedAction": "close | investigate | report_and_block",
  "summary": "short explanation",
  "findings": [
    {
      "severity": "low | medium | high",
      "explanation": "reason",
      "evidence": "quote from email"
    }
  ],
  "followUpQuestions": []
}
`;

  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3",
      prompt,
      stream: false
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.response);
  } catch (err) {
    throw new Error("Invalid JSON returned from LLM");
  }
}

module.exports = { analyzeReview };
