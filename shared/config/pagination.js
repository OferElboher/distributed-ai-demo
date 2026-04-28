///////////////////////////////////////////////////////////////////////////////
// Pagination Configuration (Shared Contract)
///////////////////////////////////////////////////////////////////////////////

/**
 * Single source of truth for pagination size
 * used by both frontend and backend.
 *
 * PURPOSE:
 * - Ensures consistent page size across all backend & frontend requests
 * - Prevents hardcoded duplication in API calls and state logic
 */
const REVIEW_PAGE_SIZE = 20;

module.exports = {
  REVIEW_PAGE_SIZE,
};