# Recruitment Dashboard (Fixed)

This repository contains a small Recruitment Management Dashboard (FastAPI backend + vanilla frontend) with production-ready fixes and UX improvements.

## Installation

Requirements: Python 3.9+, pip

1. Install dependencies:

   pip install fastapi uvicorn pandas openpyxl requests

2. Run the server:

   uvicorn app:app --reload --port 8000

3. Open in browser:

   http://127.0.0.1:8000/

## What's Fixed / Implemented

Backend:
- Added indexes for faster queries (jd_id, status, submission_date, last_updated).
- Candidates API now supports search (name/email/skills), sorting, and pagination.
- Status updates include strict validation: only Submitted -> Interviewing -> Rejected/Accepted allowed; terminal states (Rejected/Accepted) cannot be changed; duplicate updates are blocked.
- Optimistic concurrency protection (last_updated check) and proper HTTP 409 on conflicts.
- Bulk updates are atomic (BEGIN IMMEDIATE transaction) and will rollback if any candidate fails validation.

Frontend:
- Live search with 300ms debouncing and search + sort + pagination controls.
- Pagination controls and page size selection implemented.
- Row selection checkboxes and bulk update flow implemented with inline error messaging (no alert boxes).
- Loading indicators (spinners) and buttons disabled during async operations to prevent duplicate clicks.
- Reports render as visual charts (status distribution and trend bars) instead of raw JSON.
- Match view shows formatted skills and a progress bar for match score (no raw JSON).
- Status badges with color-coded pills and nicely balanced button layout.

UX:
- Dates formatted in user-friendly format (e.g., "Dec 19, 2025").
- Skills displayed comma-separated.
- Inline error messages and empty-state handling.

## Tests

A simple test script is included to verify key behaviors. Install `requests` then run:

   python -m pytest -q

or run the smoke script:

   python tests/test_api.py

## Notes

- The project uses a small SQLite database (`recruitment_base.db`) and includes an auto-import feature that will load `recruitment_base_template.xlsx` on first run if present.
- This branch includes intentional fixes for concurrency and transaction-safety.

Enjoy!
