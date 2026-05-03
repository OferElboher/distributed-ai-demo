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

  console.log(`[${new Date().toISOString()}] LLM CALL START review=${review._id}`);
  // TEMP DEBUG CODE: LLM DISABLED: START
  if (process.env.DISABLE_LLM === "true") {
    return {
      verdict: "safe",
      findings: [
        {
          type: "mock",
          description: "LLM disabled - mock result"
        }
      ],
      followUpQuestions: [],
      recommendedAction: "none"
    };
  };
  // TEMP DEBUG CODE: LLM DISABLED: END

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

IMPORTANT RULES:
- If verdict is "benign" then recommendedAction MUST be "close"
- If verdict is "suspicious" then recommendedAction MUST be "investigate"
- If verdict is "likely_phishing" then recommendedAction MUST be "report_and_block"
`;
  const res = await fetch("http://host.docker.internal:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3",
      prompt,
      stream: false,
      format: "json"
    })
  });

  const data = await res.json();
  try {
    let raw = data.response;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        console.log(`[${new Date().toISOString()}] RAW LLM OUTPUT:\n`, raw);
        throw new Error("Invalid JSON returned from LLM");
      }
      parsed = JSON.parse(match[0]);
    }
    // ENFORCE CONSISTENCY (hard rule)
    let response = parsed;
    if (response.verdict === "benign") {
      response.recommendedAction = "close";
    }
    if (response.verdict === "suspicious") {
      response.recommendedAction = "investigate";
    }
    if (response.verdict === "likely_phishing") {
      response.recommendedAction = "report_and_block";
    }
    console.log(
      `[${new Date().toISOString()}] LLM CALL SUCCESS review=${review._id}`
    );
    return response;
  } catch (err) {
    console.log(
      `[${new Date().toISOString()}] LLM CALL FAILURE review=${review._id}`,
      err
    );
    throw err;
  }
}

module.exports = { analyzeReview };
