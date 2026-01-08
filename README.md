Recruitment Dashboard (Fixed)

This workspace contains a small Recruitment Management Dashboard (FastAPI backend + single-page frontend). I fixed bugs, implemented missing features, and improved UI/UX to be production-friendly.

Quick start

1. Create a virtualenv and install deps:
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt  # or: pip install fastapi uvicorn pandas openpyxl

2. Start the server:
   python -m uvicorn app:app --port 8000

3. Open in your browser:
   http://127.0.0.1:8000/

What I changed (high-level)

- Backend (app.py):
  - Added useful indexes to the SQLite schema for performance.
  - Rewrote /api/candidates to support free-text search (name/email/skills), sorting and pagination (page/page_size) and returns total count and page info.
  - Hardened /api/update_status with strict validation (no invalid transitions), duplicate update protection, and a simple concurrency protection using an immediate transaction lock.
  - Implemented /api/bulk_update_status as atomic: validates all targets first and rolls back on any error.
  - Improved match scoring and kept audit trail entries for status changes.

- Frontend (index.html, script.js, styles.css):
  - Live search with 300ms debounce and sorting/page-size controls.
  - Pagination with Prev/Next and page info.
  - Row selection (checkboxes), Select All / Deselect All, and Bulk Update (calls backend atomic endpoint).
  - Inline error messages (no alert()) and loading states/spinners; buttons disabled during operations to avoid duplicate clicks.
  - Reports now show formatted status summaries and trends (no raw JSON), match view shows a progress bar and readable explanation.
  - Date formatting (e.g., "Dec 19, 2025"), status color badges, progress bars, and better button hierarchy and layout.

Testing notes / evidence

- Server exposes endpoints and auto-imports the included template (if DB empty).
- I manually verified via the API that invalid transitions (e.g., Rejected -> Submitted) are rejected with HTTP 400.
- Bulk updates are atomic: attempts that include an invalid candidate fail (400) and no partial updates occur.
- The frontend demonstrates debounced search, pagination, bulk actions, and improved visuals.

If you'd like, I can also add unit tests or expand the UI with charts (e.g., Chart.js) for richer visualizations.
