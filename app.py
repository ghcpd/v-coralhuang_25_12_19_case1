#!/usr/bin/env python3
"""
Recruitment Dashboard (Base) - Backend API (FastAPI)

Files:
- app.py: Backend API server
- index.html: Frontend HTML
- styles.css: Frontend CSS
- script.js: Frontend JavaScript
- SQLite DB is created locally as recruitment_base.db

Install:
  pip install fastapi uvicorn pandas openpyxl

Run:
  uvicorn app:app --reload --port 8000

Open:
  http://127.0.0.1:8000/

APIs:
  POST /api/import  (multipart file upload: excel)
  GET  /api/candidates?jd=JD-1001
  GET  /api/report?jd=JD-1001
  GET  /api/match/C-0001
  POST /api/update_status  JSON: {candidate_id, status, reason}
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Tuple

import sqlite3
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware


DB_PATH = Path("recruitment_base.db")

app = FastAPI(title="Recruitment Dashboard (Base)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS jds (
            jd_id TEXT PRIMARY KEY,
            title TEXT,
            must_have_skills TEXT,
            nice_to_have_skills TEXT,
            min_years_exp INTEGER,
            location TEXT,
            jd_version INTEGER,
            jd_last_updated TEXT
        );

        CREATE TABLE IF NOT EXISTS candidates (
            candidate_id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT,
            jd_id TEXT,
            skills TEXT,
            years_exp INTEGER,
            location TEXT,
            submission_date TEXT,
            current_status TEXT,
            interview_round TEXT,
            rejection_reason TEXT,
            notes TEXT,
            last_updated TEXT,
            FOREIGN KEY (jd_id) REFERENCES jds (jd_id)
        );

        CREATE TABLE IF NOT EXISTS status_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id TEXT,
            old_status TEXT,
            new_status TEXT,
            changed_at TEXT,
            reason TEXT,
            FOREIGN KEY (candidate_id) REFERENCES candidates (candidate_id)
        );
        """
    )
    conn.commit()


def normalize_semicolon_list(value: str) -> List[str]:
    if value is None:
        return []
    s = str(value).strip()
    if not s:
        return []
    return [x.strip().lower() for x in s.split(";") if x.strip()]


def fetch_one(conn: sqlite3.Connection, sql: str, params: Tuple = ()):
    cur = conn.execute(sql, params)
    return cur.fetchone()


def fetch_all(conn: sqlite3.Connection, sql: str, params: Tuple = ()):
    cur = conn.execute(sql, params)
    return cur.fetchall()


def import_excel_to_db(excel_path: Path) -> Dict:
    if not excel_path.exists():
        raise FileNotFoundError(f"Excel not found: {excel_path}")

    xls = pd.ExcelFile(excel_path)
    if "JDs" not in xls.sheet_names or "Candidates" not in xls.sheet_names:
        raise ValueError("Excel must contain sheets named 'JDs' and 'Candidates'.")

    jds = pd.read_excel(excel_path, sheet_name="JDs")
    cands = pd.read_excel(excel_path, sheet_name="Candidates")

    required_jd_cols = {
        "JD_ID", "Title", "Must_Have_Skills", "Nice_To_Have_Skills",
        "Min_Years_Exp", "Location", "JD_Version", "JD_Last_Updated",
    }
    required_cand_cols = {
        "Candidate_ID", "Name", "Email", "JD_ID", "Skills", "Years_Exp", "Location",
        "Submission_Date", "Current_Status", "Interview_Round", "Rejection_Reason", "Notes"
    }

    missing_jd = required_jd_cols - set(jds.columns)
    missing_cand = required_cand_cols - set(cands.columns)
    if missing_jd:
        raise ValueError(f"Missing JD columns: {sorted(missing_jd)}")
    if missing_cand:
        raise ValueError(f"Missing Candidate columns: {sorted(missing_cand)}")

    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    with _connect() as conn:
        init_db(conn)

        for _, row in jds.iterrows():
            conn.execute(
                """
                INSERT INTO jds (jd_id, title, must_have_skills, nice_to_have_skills, min_years_exp, location, jd_version, jd_last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(jd_id) DO UPDATE SET
                    title=excluded.title,
                    must_have_skills=excluded.must_have_skills,
                    nice_to_have_skills=excluded.nice_to_have_skills,
                    min_years_exp=excluded.min_years_exp,
                    location=excluded.location,
                    jd_version=excluded.jd_version,
                    jd_last_updated=excluded.jd_last_updated;
                """,
                (
                    str(row["JD_ID"]).strip(),
                    str(row["Title"]).strip(),
                    str(row["Must_Have_Skills"]).strip(),
                    str(row["Nice_To_Have_Skills"]).strip(),
                    int(row["Min_Years_Exp"]),
                    str(row["Location"]).strip(),
                    int(row["JD_Version"]),
                    str(row["JD_Last_Updated"]).strip(),
                ),
            )

        for _, row in cands.iterrows():
            cid = str(row["Candidate_ID"]).strip()
            conn.execute(
                """
                INSERT INTO candidates (candidate_id, name, email, jd_id, skills, years_exp, location, submission_date,
                                        current_status, interview_round, rejection_reason, notes, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(candidate_id) DO UPDATE SET
                    name=excluded.name,
                    email=excluded.email,
                    jd_id=excluded.jd_id,
                    skills=excluded.skills,
                    years_exp=excluded.years_exp,
                    location=excluded.location,
                    submission_date=excluded.submission_date,
                    current_status=excluded.current_status,
                    interview_round=excluded.interview_round,
                    rejection_reason=excluded.rejection_reason,
                    notes=excluded.notes,
                    last_updated=excluded.last_updated;
                """,
                (
                    cid,
                    str(row["Name"]).strip(),
                    str(row["Email"]).strip(),
                    str(row["JD_ID"]).strip(),
                    str(row["Skills"]).strip(),
                    int(row["Years_Exp"]),
                    str(row["Location"]).strip(),
                    str(row["Submission_Date"]).strip(),
                    str(row["Current_Status"]).strip(),
                    str(row["Interview_Round"]).strip() if not pd.isna(row["Interview_Round"]) else "",
                    str(row["Rejection_Reason"]).strip() if not pd.isna(row["Rejection_Reason"]) else "",
                    str(row["Notes"]).strip() if not pd.isna(row["Notes"]) else "",
                    now,
                ),
            )
        conn.commit()

    return {"imported_jds": int(len(jds)), "imported_candidates": int(len(cands)), "db": str(DB_PATH)}


def compute_match_score(jd_row: Dict, cand_row: Dict) -> Tuple[int, str, Dict]:
    jd_must = set(normalize_semicolon_list(jd_row["must_have_skills"]))
    jd_nice = set(normalize_semicolon_list(jd_row["nice_to_have_skills"]))
    cand_skills = set(normalize_semicolon_list(cand_row["skills"]))

    must_hit = len(jd_must & cand_skills)
    nice_hit = len(jd_nice & cand_skills)

    score = 0
    if jd_must:
        score += int(60 * (must_hit / len(jd_must)))
    if jd_nice:
        score += int(25 * (nice_hit / len(jd_nice)))

    exp_ok = int(cand_row["years_exp"]) >= int(jd_row["min_years_exp"])
    loc_ok = str(cand_row["location"]).strip().lower() == str(jd_row["location"]).strip().lower()

    score += 10 if exp_ok else 0
    score += 5 if loc_ok else 0

    if score >= 80:
        label = "Fit"
    elif score >= 55:
        label = "Partial Fit"
    else:
        label = "Not Fit"

    explain = {
        "must_have_hit": must_hit,
        "must_have_total": len(jd_must),
        "nice_to_have_hit": nice_hit,
        "nice_to_have_total": len(jd_nice),
        "exp_ok": exp_ok,
        "loc_ok": loc_ok,
        "score_breakdown": {
            "must_have_component": int(60 * (must_hit / len(jd_must))) if jd_must else 0,
            "nice_to_have_component": int(25 * (nice_hit / len(jd_nice))) if jd_nice else 0,
            "experience_bonus": 10 if exp_ok else 0,
            "location_bonus": 5 if loc_ok else 0,
        },
        "jd_version": jd_row["jd_version"],
        "jd_last_updated": jd_row["jd_last_updated"],
    }
    return score, label, explain


@app.on_event("startup")
async def startup_event():
    """Auto-import template Excel on startup if DB is empty"""
    template_path = Path("recruitment_base_template.xlsx")
    if template_path.exists():
        with _connect() as conn:
            init_db(conn)
            # Check if DB has data
            result = fetch_one(conn, "SELECT COUNT(*) FROM candidates;")
            if result and result[0] == 0:
                try:
                    print(f"Auto-importing {template_path}...")
                    import_excel_to_db(template_path)
                    print("Auto-import successful!")
                except Exception as e:
                    print(f"Auto-import failed: {e}")


@app.get("/", response_class=HTMLResponse)
def home():
    return FileResponse("index.html")


@app.get("/styles.css")
def styles():
    return FileResponse("styles.css")


@app.get("/script.js")
def script():
    return FileResponse("script.js")


@app.get("/api/auto_import_status")
def auto_import_status():
    """Check if data has been imported"""
    with _connect() as conn:
        init_db(conn)
        cand_count = fetch_one(conn, "SELECT COUNT(*) FROM candidates;")
        jd_count = fetch_one(conn, "SELECT COUNT(*) FROM jds;")
        return {
            "has_data": (cand_count[0] if cand_count else 0) > 0,
            "candidate_count": cand_count[0] if cand_count else 0,
            "jd_count": jd_count[0] if jd_count else 0
        }


@app.post("/api/import")
async def api_import(excel: UploadFile = File(...)):
    if not excel.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx is supported.")
    tmp = Path("upload_tmp.xlsx")
    content = await excel.read()
    tmp.write_bytes(content)
    try:
        result = import_excel_to_db(tmp)
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass


@app.get("/api/candidates")
def api_candidates(jd: Optional[str] = None):
    with _connect() as conn:
        init_db(conn)
        if jd:
            rows = fetch_all(
                conn,
                """
                SELECT candidate_id, name, email, jd_id, submission_date, current_status
                FROM candidates
                WHERE jd_id = ?
                ORDER BY submission_date DESC;
                """,
                (jd,),
            )
        else:
            rows = fetch_all(
                conn,
                """
                SELECT candidate_id, name, email, jd_id, submission_date, current_status
                FROM candidates
                ORDER BY submission_date DESC;
                """,
            )

    items = [
        {
            "candidate_id": r[0],
            "name": r[1],
            "email": r[2],
            "jd_id": r[3],
            "submission_date": r[4],
            "current_status": r[5],
        }
        for r in rows
    ]
    return {"items": items, "count": len(items)}


@app.get("/api/report")
def api_report(jd: Optional[str] = None):
    with _connect() as conn:
        init_db(conn)
        where = ""
        params: Tuple = ()
        if jd:
            where = "WHERE jd_id = ?"
            params = (jd,)

        rows = fetch_all(
            conn,
            f"""
            SELECT current_status, COUNT(*) as cnt
            FROM candidates
            {where}
            GROUP BY current_status
            ORDER BY cnt DESC;
            """,
            params,
        )
        trend = fetch_all(
            conn,
            f"""
            SELECT submission_date, COUNT(*) as submissions
            FROM candidates
            {where}
            GROUP BY submission_date
            ORDER BY submission_date ASC;
            """,
            params,
        )

    return {
        "filter_jd": jd,
        "status_summary": [{"current_status": r[0], "count": r[1]} for r in rows],
        "submission_trend": [{"submission_date": t[0], "submissions": t[1]} for t in trend],
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }


@app.get("/api/match/{candidate_id}")
def api_match(candidate_id: str):
    with _connect() as conn:
        init_db(conn)
        cand = fetch_one(
            conn,
            """
            SELECT candidate_id, name, jd_id, skills, years_exp, location
            FROM candidates
            WHERE candidate_id = ?;
            """,
            (candidate_id,),
        )
        if not cand:
            raise HTTPException(status_code=404, detail=f"Candidate not found: {candidate_id}")

        cand_row = {
            "candidate_id": cand[0],
            "name": cand[1],
            "jd_id": cand[2],
            "skills": cand[3],
            "years_exp": cand[4],
            "location": cand[5],
        }

        jd = fetch_one(
            conn,
            """
            SELECT jd_id, title, must_have_skills, nice_to_have_skills, min_years_exp, location, jd_version, jd_last_updated
            FROM jds
            WHERE jd_id = ?;
            """,
            (cand_row["jd_id"],),
        )
        if not jd:
            raise HTTPException(status_code=404, detail=f"JD not found: {cand_row['jd_id']}")

        jd_row = {
            "jd_id": jd[0],
            "title": jd[1],
            "must_have_skills": jd[2],
            "nice_to_have_skills": jd[3],
            "min_years_exp": jd[4],
            "location": jd[5],
            "jd_version": jd[6],
            "jd_last_updated": jd[7],
        }

    score, label, explain = compute_match_score(jd_row, cand_row)
    return {
        "candidate_id": candidate_id,
        "jd_id": jd_row["jd_id"],
        "jd_title": jd_row["title"],
        "match_label": label,
        "match_score": score,
        "explain": explain,
    }


@app.post("/api/update_status")
async def api_update_status(payload: Dict):
    candidate_id = str(payload.get("candidate_id", "")).strip()
    status = str(payload.get("status", "")).strip()
    reason = str(payload.get("reason", "")).strip()

    if not candidate_id or not status:
        raise HTTPException(status_code=400, detail="candidate_id and status are required.")

    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with _connect() as conn:
        init_db(conn)
        old = fetch_one(conn, "SELECT current_status FROM candidates WHERE candidate_id = ?;", (candidate_id,))
        if not old:
            raise HTTPException(status_code=404, detail=f"Candidate not found: {candidate_id}")
        old_status = old[0]

        conn.execute(
            """
            UPDATE candidates
            SET current_status = ?, rejection_reason = ?, last_updated = ?
            WHERE candidate_id = ?;
            """,
            (status, reason if status.lower() == "rejected" else "", now, candidate_id),
        )
        conn.execute(
            """
            INSERT INTO status_audit (candidate_id, old_status, new_status, changed_at, reason)
            VALUES (?, ?, ?, ?, ?);
            """,
            (candidate_id, old_status, status, now, reason),
        )
        conn.commit()

    return {"updated": True, "candidate_id": candidate_id, "old_status": old_status, "new_status": status, "changed_at": now}
