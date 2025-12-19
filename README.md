# Recruitment Management Dashboard — Enhanced

This repository is a single-file demo (FastAPI backend + vanilla frontend) for a Recruitment Management Dashboard.

## What I fixed and enhanced ✅

Backend (app.py)
- Added database indexes for faster lookups (jd_id, status, submission_date, skills).
- Implemented robust `GET /api/candidates` with full-text-ish search (`q`), sorting (`sort`), and pagination (`page`, `page_size`).
- Implemented strict status transition validation:
  - Allowed flow: Submitted → Interviewing → Rejected/Accepted
  - `Rejected` and `Accepted` are immutable
  - Blocking no-op updates (same status)
- Added optimistic concurrency checks and meaningful 409 responses (detect concurrent modifications).
- Made `POST /api/bulk_update_status` fully transactional and atomic: any validation failure rolls back the whole operation.
- Improved audit logging (`status_audit`) to correctly record old and new states.

Frontend (index.html, script.js, styles.css)
- Implemented search debouncing (300ms) and live filtering.
- Implemented sorting and pagination (prev/next + page size selector) with page info.
- Implemented row selection with checkboxes, select-all/deselect-all and a working bulk update UI.
- Disabled buttons / show loading state during async operations to prevent duplicate clicks.
- Replaced `alert()` calls with inline error messages and improved UX.
- Added status badges (color-coded) and progress bar for match scores.
- Replaced raw JSON in reports and match view with friendly visual representations (simple bars and sparklines).
- Reformatted dates and skills for readability.
- Redesigned button layout and groupings for cleaner UI hierarchy.

## How to run

Requirements:
- Python 3.9+
- pip install -r requirements (fastapi, uvicorn, pandas, openpyxl)

Quick start:
1. Create virtualenv: `python -m venv .venv && .\.venv\Scripts\activate`
2. Install deps: `pip install fastapi uvicorn pandas openpyxl`
3. Run the app: `uvicorn app:app --reload --port 8000`
4. Open http://127.0.0.1:8000/ in your browser.

## Testing & Verification
- Import `recruitment_base_template.xlsx` using the import control.
- Use the search box to search by name/email/skill terms (debounced).
- Try sorting, changing page sizes, and navigating pages.
- Select multiple rows and use "Bulk Update Selected" to change statuses (follows transition rules).
- Try updating a candidate's status twice to verify duplicate/no-op blocking.
- Attempt invalid transitions (e.g., Submitted → Rejected) to see inline errors.
- Open the Match view for a candidate to verify the score/progress bar.
- View the Report to see status distribution bars and submission trend.

## Notable design decisions
- Used optimistic concurrency rather than DB row locks to avoid locking complexity in SQLite.
- Implemented atomic bulk updates for safety and clarity.
- Kept UI lightweight (no external libraries) to keep the demo self-contained.

## Next improvements (optional)
- Add a proper modal confirmation for bulk updates.
- Add unit tests (pytest) for status transition logic and transactions.
- Use Chart.js (or similar) for richer visualizations.

If you'd like, I can run through a checklist and add some focused unit tests for the backend next.
