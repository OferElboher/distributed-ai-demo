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
 * 
 * useEffect:
 * - A React hook that runs side effects (like data fetching or subscriptions) after rendering,
 *   optionally re-running when specified dependencies change.
 * - Required for dashboard auto-refresh logic
 * 
 * useCallback:
 * - Keeps the same function reference unless dependencies change
 * - Sometimes required to stabilize UI refresh, and prevent infinite loops
 */
import { useState, useEffect, useCallback } from "react";


/**
 * Maximum number of reviews fetched per request (page size).
 *
 * PURPOSE:
 * - Limits payload size from backend
 * - Improves performance for large datasets
 * - Keeps dashboard responsive
 * Note: Can't import here "../../../shared/config/pagination", so explicitly define constants here.
 */
const REVIEW_PAGE_SIZE = 10;


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
 * 
 * NOTICE:
 * - useCallback:
 *   - Keeps the same function reference unless dependencies change
 *   - Is used here to limit recreates only to page changes, so:
 *     fetchReviews is stable, and infinite loops are prevented
 */
const fetchReviews = useCallback(async () => {
  const res = await fetch(
    `${API_BASE}/reviews?limit=${REVIEW_PAGE_SIZE}&page=${page}`
  );

  const data = await res.json();

  console.log("REVIEWS RESPONSE:", data);
  console.log("IS ARRAY:", Array.isArray(data.data));

  setReviews(data.data || []);

  /**
   * DASHBOARD-ONLY UPDATE
   * ----------------------
   * fetchReviews MUST NOT mutate active review state.
   *
   * PURPOSE:
   * - keeps dashboard independent from active polling session
   * - prevents stale "completed" review from being shown as current result
   */
  setHasMore(data.hasMore);
}, [API_BASE, page]);


/**
 * Loads initial Dashboard (Auto Refresh Hook).
 * 
 * useEffect is:
 * - A React hook that runs side-effects after render
 * - A function stored in component scope, and therefore,
 *   since React compares functions by memory identity,
 *   and not by code content, if a new function instance
 *   is created on re-render, then its reference changes,
 *   and it is rerun.
 * This entails with an infinite loop, and in order to prevent
 * that, useCallback is used with fetchReviews (see there).
 * As a result, useEffect is eventually being run here only on
 * each page mount AND whenever `page` changes.
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
}, [fetchReviews, page]);


/**
 * Polls backend for review completion status until analysis is finished.
 *
 * PURPOSE:
 * - Continuously fetches the review from the backend by ID
 * - Detects when asynchronous worker processing is complete
 * - Updates UI state with final analysis result
 *
 * ARCHITECTURE FLOW:
 * React UI
 *   → GET /reviews/:id
 *   → Express API (fetches review from MongoDB)
 *   → returns current processing state
 *   → Worker updates document asynchronously
 *   → polling detects "completed" status
 *   → UI receives final enriched review object
 *
 * TERMINATION CONDITION:
 * - Stops polling when `status === "completed"`
 *
 * BEHAVIOR:
 * - Uses recursive timeout polling (1.5s interval)
 * - Prevents blocking UI thread
 */
const pollReview = async (id) => {
  const res = await fetch(`${API_BASE}/reviews/${id}`);
  const data = await res.json();

  /**
   * POLLING STATE UPDATE
   * ---------------------
   * Updates UI on every poll iteration (not only completion).
   *
   * Adds:
   * - _polling flag → indicates active polling loop
   *
   * Purpose:
   * - make intermediate states (pending/processing) visible
   * - avoid "instant jump to completed" UX illusion
   */
  setResult({
    ...data,
    _polling: data.status !== "completed"
  });
  if (data.status !== "completed") {
    setTimeout(() => pollReview(id), 1500);
  }
};


/**
 * Submits a new email review to the backend.
 *
 * PURPOSE:
 * - Sends analyst-provided email content (`message`) to the backend API
 * - Initiates the full asynchronous triage pipeline
 *
 * ARCHITECTURE FLOW:
 * React UI
 *   → POST /test
 *   → Express API (creates Review document in MongoDB)
 *   → BullMQ queue (enqueues analysis job)
 *   → Worker processes review asynchronously
 *   → Final analysisResult persisted in DB
 *
 * RESPONSE HANDLING:
 * - Receives initial response containing reviewId and status
 * - Stores response in `result` state
 * - Triggers UI update to display review status and later results
 *
 * NOTE:
 * - This does NOT wait for analysis completion
 * - Analysis results are populated later by the worker
 */
const submitReview = async () => {
  /*
    RESET PREVIOUS RESULT
    ---------------------
    Clears last displayed review state before submitting a new request.

    PURPOSE:
    - Prevents stale analysis results from being shown during new submission
    - Ensures UI reflects only the currently active review
    - Avoids confusion between previous and current pipeline runs
  */
  setResult(null);
  const res = await fetch(`${API_BASE}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: message })
  });

  const data = await res.json();

  /**
   * INITIAL REVIEW STATE
   * ---------------------
   * Immediately sets UI to "pending" before polling begins.
   *
   * Purpose:
   * - avoids empty UI gap before first poll response
   * - clearly shows async pipeline has started
   */
  setResult({
    _id: data.reviewId,
    status: "pending",
    analysisResult: null,
    createdAt: null,
    updatedAt: null,
    _polling: true,
    _uiVersion: Date.now() // Forces React re-render separation.
  });
  pollReview(data.reviewId);
};


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
    {result && result._id && (
      <div style={{ marginTop: 20 }}>
        <h3>Review Result</h3>

        {/* 
          STATUS INDICATOR (WITH POLLING STATE)
          -------------------------------------
          Displays current backend status.

          If polling active:
          - shows "(polling...)" to indicate live updates

          POLLING LOOP
          ------------
          After submit:
          - receives reviewId from backend
          - repeatedly calls GET /reviews/:id

          BEHAVIOR:
          - fetch review state from backend every interval
          - update UI with latest status + analysisResult
          - stop polling when status === "completed"

          PURPOSE:
          - enables async User Experience (UX) without blocking request
          - reflects worker progress in real time
        */}
        <p>
          <b>Status:</b> {result.status}
          {result._polling && " (polling...)"}
        </p>

        {/* TIMESTAMPS */}
        {result.createdAt && (
          <p><b>Created:</b> {new Date(result.createdAt).toLocaleString()}</p>
        )}
        {result.updatedAt && (
          <p><b>Updated:</b> {new Date(result.updatedAt).toLocaleString()}</p>
        )}

        {/*
          ANALYSIS OUTPUT
          ---------------
          The final output of the worker (rules + LLM).
          Rendered only when analysisResult is available.
        */}
        {result.analysisResult && (
          <>
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
    {result && result._id && result.analysisResult && (
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
}

export default App;
