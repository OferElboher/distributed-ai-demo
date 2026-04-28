///////////////////////////////////////////////////////////////////////////////
// Suspicious Email Triage - Frontend (React UI)
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// Suspicious Email Triage - Frontend (React UI)
///////////////////////////////////////////////////////////////////////////////

/**
 * This component implements the analyst-facing UI for the Suspicious Email Triage system.
 *
 * It is responsible for:
 *
 * 1. Creating a new email review (Requirement #1)
 *    - Accepts raw email content from analyst input
 *    - Sends it to backend API for processing
 *
 * 2. Triggering the full backend asynchronous analysis pipeline
 *    - Backend stores review in MongoDB
 *    - Backend enqueues job into BullMQ queue
 *    - Worker processes analysis in background
 *    - Final structured analysis result is persisted in DB
 *
 * 3. Presenting structured review results (Requirement #3)
 *    - Displays verdict (benign / suspicious / likely_phishing)
 *    - Shows recommended action (close / investigate / report_and_block)
 *    - Renders findings with severity and evidence
 *    - Displays follow-up questions when applicable
 *    - Reflects current review status (pending / processing / completed)
 *
 * 4. Supporting manual analyst override (Requirement #6)
 *    - Allows overriding system verdict/action
 *    - Requires analyst justification (audit reason)
 *    - Sends override decision to backend for persistence
 *
 * ARCHITECTURE FLOW:
 *
 * React UI
 *   → HTTP POST /test (create review)
 *   → Express API (persist Review document)
 *   → MongoDB (status: pending)
 *   → BullMQ (enqueue analysis job)
 *   → Worker (async processing + rules engine)
 *   → MongoDB update (analysisResult + status)
 *   → GET /reviews/:id (fetch final state)
 *
 * STATE MODEL:
 * - message: email body input field
 * - result: full review object from backend (including analysisResult)
 * - overrideReason: analyst justification for override action
 *
 * DESIGN GOAL:
 * Provide a minimal but complete analyst workflow for triaging emails,
 * including review creation, structured analysis display, and override capability.
 */


/**
 * useState:
 * - A React hook that lets a component store and update local state values across re-renders.
 * useEffect:
 * - A React hook that runs side effects (like data fetching or subscriptions) after rendering,
 *   optionally re-running when specified dependencies change.
 * - Required for dashboard auto-refresh logic
 */
import { useState, useEffect } from "react";

import { REVIEW_PAGE_SIZE } from "../../../shared/config/pagination";


function App() {
  /**
   * Base URL for backend API requests.
   *
   * PURPOSE:
   * - Centralizes all backend HTTP calls in one configurable value
   * - Avoids repeating hardcoded "http://localhost:<port-number>"
   * - Enables environment-based switching (local / Docker / production)
   *
   * ENVIRONMENT BEHAVIOR:
   * - If REACT_APP_API_URL is defined → use it
   * - Otherwise fallback to local development server
   *
   * USED BY:
   * - submitReview (POST /reviews)
   * - fetchReviews (GET /reviews)
   * - override endpoint (POST /reviews/:id/override)
   */
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3000";

  /**
   * Controlled input state for email body content.
   * This represents the suspicious email submitted by the analyst.
   */
  const [message, setMessage] = useState("");

  /**
   * Stores backend response after submitting a review.
   * Contains:
   * - reviewId (MongoDB document reference)
   * - confirmation metadata from API
   */
  const [result, setResult] = useState(null);

  /**
   * Stores the analyst-provided justification when overriding a system result.
   *
   * The Manual Override System:
   * - captures human reasoning for changing verdict or action
   * - sent to backend override endpoint
   * - persisted for auditability and traceability
   *
   * This ensures the system maintains:
   * - accountability of analyst decisions
   * - separation between automated and manual judgments
   */
  const [overrideReason, setOverrideReason] = useState("");

  /**
   * Holds the list of all email reviews retrieved from the backend.
   *
   * Used for Review List View:
   * - displays multiple reviews in dashboard format
   * - supports quick scanning of status and results
   * - refreshed via fetchReviews() API call
   *
   * Each item contains:
   * - sender info
   * - subject
   * - status (pending / processing / completed)
   * - analysisResult (if available)
   * - updatedAt timestamp
   */
  const [reviews, setReviews] = useState([]);

  /**
   * Pagination boundary flag (frontend-derived).
   *
   * Indicates whether there are potentially more reviews
   * available beyond the current page.
   *
   * Logic:
   * - set to `true` when backend returns a full page (limit items)
   *   (That's also the initial value: See the parameter passed to useState below.)
   * - set to `false` when backend returns fewer items than `limit`
   *
   * Used to:
   * - disable "Next" button when last page is reached
   * - prevent requesting non-existent pages
   *
   * Note:
   * This is an optimistic inference based on result size,
   * not a strict backend-provided total count.
   */
  const [hasMore, setHasMore] = useState(true);

  /**
   * Pagination state for the Review Dashboard (backend-driven list view).
   *
   * PURPOSE:
   * - Controls which "page" of reviews is currently displayed in the dashboard.
   * - Works together with backend query parameters:
   *     GET /reviews?page=<page>&limit=<limit>
   *
   * ARCHITECTURE ROLE:
   * - Frontend does NOT fetch all reviews at once.
   * - Instead, it requests a paginated subset from MongoDB via API.
   * - This ensures scalability when the dataset grows large.
   *
   * BEHAVIOR:
   * - page = 0 → first page of results (most recent reviews)
   * - page = 1 → second page, etc.
   *
   * NOTE:
   * - Changing `page` automatically triggers a re-fetch via useEffect dependency.
   */
  const [page, setPage] = useState(0);

  /**
   * Maximum number of reviews fetched per request (page size).
   *
   * PURPOSE:
   * - Limits payload size from backend
   * - Improves performance for large datasets
   * - Keeps dashboard responsive
   */
  const limit = REVIEW_PAGE_SIZE;

/**
 * Fetches Reviews (Dashboard Loader).
 *
 * PURPOSE:
 * Retrieves a paginated list of reviews from the backend (/reviews)
 * using server-controlled pagination (page + limit).
 *
 * ARCHITECTURE ROLE:
 * - drives the Review Dashboard list view
 * - reflects async worker processing results
 * - provides current snapshot of system triage state
 *
 * IMPORTANT:
 * Pagination size (limit) MUST be derived from REVIEW_PAGE_SIZE
 * to ensure frontend-backend consistency.
 *
 * Backend returns:
 * - data: array of reviews
 * - page: current page
 * - limit: applied page size
 * - total: total number of reviews
 * - hasMore: whether more pages exist
 */
const fetchReviews = async () => {
  const res = await fetch(
    `${API_BASE}/reviews?limit=${REVIEW_PAGE_SIZE}&page=${page}`
  );

  const data = await res.json();

  /**
   * Update dashboard state with backend response
   */
  setReviews(data);

  /**
   * Pagination state derived from backend truth (preferred)
   */
  setHasMore(data.hasMore);
};

/**
 * Loads initial Dashboard (Auto Refresh Hook).
 * useEffect runs on mount AND whenever `page` changes.
 *
 * Purpose:
 * - Automatically loads the review dashboard on page start
 * - Fetches latest reviews from backend without user action
 * - Updates results when pagination changes
 *
 * Review List View:
 * - ensures analyst sees current triage state
 * - keeps dashboard in sync with selected page
 *
 * Arguments:
 * - 1st argument:
 *   - The function to run (fetchReviews, which uses variable page)
 *   - This function is being:
 *     - run on component mount
 *     - re-run whenever the value of any variable listed in the dependency array changes
 * - 2nd argument:
 *   - Dependency array (see 1st argument)
 */
  useEffect(() => {
    fetchReviews();
  }, [page]);


return (
  <div style={{ padding: 20 }}>
    <h2>Suspicious Email Triage</h2>

    {/* 
      USER INPUT SECTION
      -------------------
      Allows analyst to paste raw email content.

      This is a controlled React input:
      - value is bound to state (message)
      - onChange updates state immediately
    */}
    <textarea
      rows={6}
      cols={60}
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      placeholder="Paste suspicious email here..."
    />

    <br />

    {/* 
      SUBMIT ACTION
      -------------
      Triggers backend pipeline:
      frontend → POST /test → DB → queue → worker → analysis
    */}
    <button onClick={submitReview}>
      Submit for Analysis
    </button>

    {/* 
      REVIEW RESULT DISPLAY
      ----------------------
      Shows current review state returned from backend.

      IMPORTANT:
      - result exists → review was created/fetched
      - result.status shows pipeline progress (pending/processing/completed)
      - analysisResult exists ONLY after worker finishes
    */}
    {result && (
      <div style={{ marginTop: 20 }}>
        <h3>Review Result</h3>

        {/* Pipeline status indicator */}
        <p><b>Status:</b> {result.status}</p>

        {/* 
          STRUCTURED ANALYSIS OUTPUT
          --------------------------
          Rendered only when analysisResult is available.
          This is the final output of the worker (rules + LLM).
        */}
        {result.analysisResult && (
          <>
            {/* Core decision fields */}
            <p><b>Verdict:</b> {result.analysisResult.verdict}</p>
            <p><b>Recommended Action:</b> {result.analysisResult.recommendedAction}</p>
            <p><b>Summary:</b> {result.analysisResult.summary}</p>

            {/* 
              FINDINGS LIST
              -------------
              Each finding includes:
              - severity (critical/high/medium)
              - explanation (human-readable reasoning)
              - evidence (snippet or domain comparison)
            */}
            <h4>Findings</h4>
            <ul>
              {result.analysisResult.findings?.map((f, i) => (
                <li key={i}>
                  <b>{f.severity}:</b> {f.explanation}
                  <br />
                  <i>{f.evidence}</i>
                </li>
              ))}
            </ul>

            {/* 
              FOLLOW-UP QUESTIONS
              -------------------
              Shown when system confidence is low.
              Generated by:
              - deterministic fallback OR
              - LLM enrichment
            */}
            <h4>Follow-up Questions</h4>
            <ul>
              {result.analysisResult.followUpQuestions?.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    )}

    {/* 
      ANALYST OVERRIDE SECTION
      -------------------------
      Allows human analyst to override system decision.

      Stores:
      - verdict
      - recommendedAction
      - justification (overrideReason)

      Sent to: POST /reviews/:id/override
    */}
    {result && result._id && (
      <div style={{ marginTop: 20 }}>
        <h4>Override Decision</h4>

        {/* Analyst justification input */}
        <input
          type="text"
          placeholder="Override reason"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          style={{ width: "60%" }}
        />

        <br /><br />

        {/* Submit override to backend */}
        <button
          onClick={async () => {
            await fetch(
              `${API_BASE}/reviews/${result._id}/override`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  verdict: result.analysisResult?.verdict,
                  recommendedAction: result.analysisResult?.recommendedAction,
                  reason: overrideReason
                })
              }
            );

            alert("Override saved");
          }}
        >
          Save Override
        </button>
      </div>
    )}

    {/* 
      REVIEW DASHBOARD (PAGINATED LIST)
      ---------------------------------
      Displays a list of reviews fetched from backend.

      IMPORTANT:
      - Uses fetchReviews()
      - Controlled by page + limit (pagination)
      - Shows summary-level data only (not full details)
    */}
    <div style={{ marginTop: 40 }}>
      <h3>Review Dashboard</h3>

      {/* Manual refresh */}
      <button onClick={fetchReviews}>
        Refresh
      </button>

      {/* Pagination controls */}
      <button
        onClick={() => setPage(prev => Math.max(prev - 1, 0))}
        disabled={page === 0}
      >
        Prev
      </button>

      <span style={{ margin: "0 10px" }}>
        Page {page}
      </span>

      <button
        onClick={() => setPage(prev => prev + 1)}
        disabled={!hasMore}
      >
        Next
      </button>

      {/* 
        LIST OF REQUESTED REVIEWS (paginated subset)
        --------------------------------------------
        Not all reviews — only current page.
      */}
      <ul>
        {reviews.map((r) => (
          <li key={r._id} style={{ marginBottom: 12 }}>
            <b>{r.subject}</b>
            <br />

            Status: {r.status}
            <br />

            Verdict: {r.analysisResult?.verdict || "N/A"}
            <br />

            Action: {r.analysisResult?.recommendedAction || "N/A"}
            <br />

            Updated: {new Date(r.updatedAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>

  </div>
);

export default App;
///////////////////////////////////////////////////////////////////////////////
// Suspicious Email Triage - Frontend (React UI)
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// Suspicious Email Triage - Frontend (React UI)
///////////////////////////////////////////////////////////////////////////////

/**
 * This component implements the analyst-facing UI for the Suspicious Email Triage system.
 *
 * It is responsible for:
 *
 * 1. Creating a new email review (Requirement #1)
 *    - Accepts raw email content from analyst input
 *    - Sends it to backend API for processing
 *
 * 2. Triggering the full backend asynchronous analysis pipeline
 *    - Backend stores review in MongoDB
 *    - Backend enqueues job into BullMQ queue
 *    - Worker processes analysis in background
 *    - Final structured analysis result is persisted in DB
 *
 * 3. Presenting structured review results (Requirement #3)
 *    - Displays verdict (benign / suspicious / likely_phishing)
 *    - Shows recommended action (close / investigate / report_and_block)
 *    - Renders findings with severity and evidence
 *    - Displays follow-up questions when applicable
 *    - Reflects current review status (pending / processing / completed)
 *
 * 4. Supporting manual analyst override (Requirement #6)
 *    - Allows overriding system verdict/action
 *    - Requires analyst justification (audit reason)
 *    - Sends override decision to backend for persistence
 *
 * ARCHITECTURE FLOW:
 *
 * React UI
 *   → HTTP POST /test (create review)
 *   → Express API (persist Review document)
 *   → MongoDB (status: pending)
 *   → BullMQ (enqueue analysis job)
 *   → Worker (async processing + rules engine)
 *   → MongoDB update (analysisResult + status)
 *   → GET /reviews/:id (fetch final state)
 *
 * STATE MODEL:
 * - message: email body input field
 * - result: full review object from backend (including analysisResult)
 * - overrideReason: analyst justification for override action
 *
 * DESIGN GOAL:
 * Provide a minimal but complete analyst workflow for triaging emails,
 * including review creation, structured analysis display, and override capability.
 */


import { useState } from "react";

import { REVIEW_PAGE_SIZE } from "../../../shared/config/pagination";


function App() {
  /**
   * Controlled input state for email body content.
   * This represents the suspicious email submitted by the analyst.
   */
  const [message, setMessage] = useState("");

  /**
   * Stores backend response after submitting a review.
   * Contains:
   * - reviewId (MongoDB document reference)
   * - confirmation metadata from API
   */
  const [result, setResult] = useState(null);

  /**
   * Stores the analyst-provided justification when overriding a system result.
   *
   * The Manual Override System:
   * - captures human reasoning for changing verdict or action
   * - sent to backend override endpoint
   * - persisted for auditability and traceability
   *
   * This ensures the system maintains:
   * - accountability of analyst decisions
   * - separation between automated and manual judgments
   */
  const [overrideReason, setOverrideReason] = useState("");

  /**
   * Holds the list of all email reviews retrieved from the backend.
   *
   * Used for Review List View:
   * - displays multiple reviews in dashboard format
   * - supports quick scanning of status and results
   * - refreshed via fetchReviews() API call
   *
   * Each item contains:
   * - sender info
   * - subject
   * - status (pending / processing / completed)
   * - analysisResult (if available)
   * - updatedAt timestamp
   */
  const [reviews, setReviews] = useState([]);

  /**
   * Pagination boundary flag (frontend-derived).
   *
   * Indicates whether there are potentially more reviews
   * available beyond the current page.
   *
   * Logic:
   * - set to `true` when backend returns a full page (limit items)
   *   (That's also the initial value: See the parameter passed to useState below.)
   * - set to `false` when backend returns fewer items than `limit`
   *
   * Used to:
   * - disable "Next" button when last page is reached
   * - prevent requesting non-existent pages
   *
   * Note:
   * This is an optimistic inference based on result size,
   * not a strict backend-provided total count.
   */
  const [hasMore, setHasMore] = useState(true);

  /**
   * Pagination state for the Review Dashboard (backend-driven list view).
   *
   * PURPOSE:
   * - Controls which "page" of reviews is currently displayed in the dashboard.
   * - Works together with backend query parameters:
   *     GET /reviews?page=<page>&limit=<limit>
   *
   * ARCHITECTURE ROLE:
   * - Frontend does NOT fetch all reviews at once.
   * - Instead, it requests a paginated subset from MongoDB via API.
   * - This ensures scalability when the dataset grows large.
   *
   * BEHAVIOR:
   * - page = 0 → first page of results (most recent reviews)
   * - page = 1 → second page, etc.
   *
   * NOTE:
   * - Changing `page` automatically triggers a re-fetch via useEffect dependency.
   */
  const [page, setPage] = useState(0);

  /**
   * Maximum number of reviews fetched per request (page size).
   *
   * PURPOSE:
   * - Limits payload size from backend
   * - Improves performance for large datasets
   * - Keeps dashboard responsive
   */
  const limit = REVIEW_PAGE_SIZE;

  /**
   * Submits review and then continuously fetches its state
   * until async processing is completed.
   * Handles full lifecycle of a review submission from the frontend
   * to backend for processing.
   *
   * Triggers the full asynchronous triage pipeline:
   * - database persistence
   * - queue dispatch
   * - worker analysis
   *
   * Implements a two-step backend interaction pattern:
   * - STEP 1: Create review + trigger async processing
   * - STEP 2: Poll to fetch current state of that review from database
   *
   * ARCHITECTURE FLOW:
   *
   * UI (React)
   *   → POST /test
   *     → creates Review in MongoDB (status = "pending")
   *     → enqueues job in BullMQ
   *
   * Worker (async, separate process)
   *   → picks job from queue
   *   → runs rules + LLM
   *   → updates Review (status = "completed", analysisResult populated)
   *
   * UI (this function)
   *   → GET /reviews/:id
   *   → retrieves latest persisted state
   *
   * IMPORTANT BEHAVIOR:
   * - The second fetch may return:
   *   - status = "pending" or "processing" (worker still running)
   *   - OR full analysisResult (if worker already finished)
   *
   * This reflects real asynchronous system behavior.
   */
  const submitReview = async () => {

    /**
     * STEP 1: Create review + trigger worker
     *
     * Send raw email content to backend endpoint POST /test.
     *
     * Backend responsibilities:
     * - persist review in MongoDB
     * - enqueue async analysis job
     * - return reviewId immediately (non-blocking)
     */
    const res = await fetch(`${API_BASE}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    const reviewId = data.id;

    /**
     * STEP 2: Poll backend until processing completes
     *
     * Fetch full review document from backend endpoint GET /reviews/:id.
     * 
     * Retrieves:
     * - current status (pending / processing / completed)
     * - analysisResult (if already computed)
     * 
     * Polling strategy:
     * - interval: 2 seconds
     * - stop when:
     *   - status === "completed"
     *   - status === "failed"
     */
    const poll = async () => {
      const reviewRes = await fetch(
        `${API_BASE}/reviews/${reviewId}`
      );

      const fullReview = await reviewRes.json();

      /**
       * Update UI on every poll
       */
      setResult(fullReview);

      /**
       * Stop condition
       */
      if (
        fullReview.status === "completed" ||
        fullReview.status === "failed"
      ) {
        return; // stop polling
      }

      /**
       * Continue polling after delay
       */
      setTimeout(poll, 2000);
    };

    /**
     * Start polling
     */
    poll();
  };

/**
 * Fetches Reviews (Dashboard Loader).
 *
 * PURPOSE:
 * Retrieves a paginated list of reviews from the backend (/reviews)
 * using server-controlled pagination (page + limit).
 *
 * ARCHITECTURE ROLE:
 * - drives the Review Dashboard list view
 * - reflects async worker processing results
 * - provides current snapshot of system triage state
 *
 * IMPORTANT:
 * Pagination size (limit) MUST be derived from REVIEW_PAGE_SIZE
 * to ensure frontend-backend consistency.
 *
 * Backend returns:
 * - data: array of reviews
 * - page: current page
 * - limit: applied page size
 * - total: total number of reviews
 * - hasMore: whether more pages exist
 */
const fetchReviews = async () => {
  const res = await fetch(
    `${API_BASE}/reviews?limit=${REVIEW_PAGE_SIZE}&page=${page}`
  );

  const data = await res.json();

  /**
   * Update dashboard state with backend response
   */
  setReviews(data.data);

  /**
   * Pagination state derived from backend truth (preferred)
   */
  setHasMore(data.hasMore);
};

///////////////////////////////////////////////////////////////////////////////
// TBD - Planned Features
///////////////////////////////////////////////////////////////////////////////

/**
 * Replacing skip/limit pagination with cursor-based pagination
 * to improve performance and avoid issues with large datasets or
 * concurrent inserts changing page boundaries.
 */

/**
 * Loads initial Dashboard (Auto Refresh Hook).
 * useEffect runs on mount AND whenever `page` changes.
 *
 * Purpose:
 * - Automatically loads the review dashboard on page start
 * - Fetches latest reviews from backend without user action
 * - Updates results when pagination changes
 *
 * Review List View:
 * - ensures analyst sees current triage state
 * - keeps dashboard in sync with selected page
 *
 * Arguments:
 * - 1st argument:
 *   - The function to run (fetchReviews, which uses variable page)
 *   - This function is being:
 *     - run on component mount
 *     - re-run whenever the value of any variable listed in the dependency array changes
 * - 2nd argument:
 *   - Dependency array (see 1st argument)
 */
  useEffect(() => {
    fetchReviews();
  }, [page]);


return (
  <div style={{ padding: 20 }}>
    <h2>Suspicious Email Triage</h2>

    {/* 
      USER INPUT SECTION
      -------------------
      Allows analyst to paste raw email content.

      This is a controlled React input:
      - value is bound to state (message)
      - onChange updates state immediately
    */}
    <textarea
      rows={6}
      cols={60}
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      placeholder="Paste suspicious email here..."
    />

    <br />

    {/* 
      SUBMIT ACTION
      -------------
      Triggers backend pipeline:
      frontend → POST /test → DB → queue → worker → analysis
    */}
    <button onClick={submitReview}>
      Submit for Analysis
    </button>

    {/* 
      REVIEW RESULT DISPLAY
      ----------------------
      Shows current review state returned from backend.

      IMPORTANT:
      - result exists → review was created/fetched
      - result.status shows pipeline progress (pending/processing/completed)
      - analysisResult exists ONLY after worker finishes
    */}
    {result && (
      <div style={{ marginTop: 20 }}>
        <h3>Review Result</h3>

        {/* Pipeline status indicator */}
        <p><b>Status:</b> {result.status}</p>

        {/* 
          STRUCTURED ANALYSIS OUTPUT
          --------------------------
          Rendered only when analysisResult is available.
          This is the final output of the worker (rules + LLM).
        */}
        {result.analysisResult && (
          <>
            {/* Core decision fields */}
            <p><b>Verdict:</b> {result.analysisResult.verdict}</p>
            <p><b>Recommended Action:</b> {result.analysisResult.recommendedAction}</p>
            <p><b>Summary:</b> {result.analysisResult.summary}</p>

            {/* 
              FINDINGS LIST
              -------------
              Each finding includes:
              - severity (critical/high/medium)
              - explanation (human-readable reasoning)
              - evidence (snippet or domain comparison)
            */}
            <h4>Findings</h4>
            <ul>
              {result.analysisResult.findings?.map((f, i) => (
                <li key={i}>
                  <b>{f.severity}:</b> {f.explanation}
                  <br />
                  <i>{f.evidence}</i>
                </li>
              ))}
            </ul>

            {/* 
              FOLLOW-UP QUESTIONS
              -------------------
              Shown when system confidence is low.
              Generated by:
              - deterministic fallback OR
              - LLM enrichment
            */}
            <h4>Follow-up Questions</h4>
            <ul>
              {result.analysisResult.followUpQuestions?.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    )}

    {/* 
      ANALYST OVERRIDE SECTION
      -------------------------
      Allows human analyst to override system decision.

      Stores:
      - verdict
      - recommendedAction
      - justification (overrideReason)

      Sent to: POST /reviews/:id/override
    */}
    {result && result._id && (
      <div style={{ marginTop: 20 }}>
        <h4>Override Decision</h4>

        {/* Analyst justification input */}
        <input
          type="text"
          placeholder="Override reason"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          style={{ width: "60%" }}
        />

        <br /><br />

        {/* Submit override to backend */}
        <button
          onClick={async () => {
            await fetch(
              `${API_BASE}/reviews/${result._id}/override`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  verdict: result.analysisResult?.verdict,
                  recommendedAction: result.analysisResult?.recommendedAction,
                  reason: overrideReason
                })
              }
            );

            alert("Override saved");
          }}
        >
          Save Override
        </button>
      </div>
    )}

    {/* 
      REVIEW DASHBOARD (PAGINATED LIST)
      ---------------------------------
      Displays a list of reviews fetched from backend.

      IMPORTANT:
      - Uses fetchReviews()
      - Controlled by page + limit (pagination)
      - Shows summary-level data only (not full details)
    */}
    <div style={{ marginTop: 40 }}>
      <h3>Review Dashboard</h3>

      {/* Manual refresh */}
      <button onClick={fetchReviews}>
        Refresh
      </button>

      {/* Pagination controls */}
      <div style={{ marginTop: 10 }}>
        <button onClick={() => setPage(Math.max(page - 1, 0))}>
          Prev
        </button>

        <span style={{ margin: "0 10px" }}>
          Page {page}
        </span>

        <button onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>

      {/* 
        LIST OF REQUESTED REVIEWS (paginated subset)
        --------------------------------------------
        Not all reviews — only current page.
      */}
      <ul>
        {reviews.map((r) => (
          <li key={r._id} style={{ marginBottom: 12 }}>
            <b>{r.subject}</b>
            <br />

            Status: {r.status}
            <br />

            Verdict: {r.analysisResult?.verdict || "N/A"}
            <br />

            Action: {r.analysisResult?.recommendedAction || "N/A"}
            <br />

            Updated: {new Date(r.updatedAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>

  </div>
);

export default App;
