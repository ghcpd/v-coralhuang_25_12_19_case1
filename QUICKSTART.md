# QUICK START GUIDE

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
pip install fastapi uvicorn pandas openpyxl
```

### Step 2: Run the Server
```bash
uvicorn app:app --reload --port 8000
```

### Step 3: Open in Browser
```
http://127.0.0.1:8000
```

### Step 4: Import Data
1. Click "📁 Import Data"
2. Select `recruitment_base_template.xlsx` or your Excel file
3. Click "Import"
4. Data loads automatically

### Step 5: Start Using
- **Search**: Type in search box (debounced, case-insensitive)
- **Filter**: Select JD ID and click "Apply Filters"
- **Sort**: Choose sort option and apply
- **Select**: Check boxes to select candidates
- **Update**: Click "Update" button on candidate row
- **Bulk Update**: Select multiple and use bulk update section
- **Match**: Click "Match" to see skill scoring
- **Reports**: Generate reports for analytics

---

## 📊 Key Features at a Glance

| Feature | Location | How to Use |
|---------|----------|-----------|
| **Search** | Top of table | Type name, email, or skill (auto-searches) |
| **Sort** | Top of table | Select sort option and click "Apply" |
| **Pagination** | Bottom of table | Use prev/next buttons or select page size |
| **Select** | Left of each row | Check boxes to select multiple |
| **Bulk Update** | Middle section | Select candidates → choose status → click update |
| **Individual Update** | Right section | Enter ID → select status → click update |
| **Matching** | Right section | Enter candidate ID → view score & breakdown |
| **Reports** | Bottom section | Enter JD ID (optional) → view charts |

---

## ✅ Feature Checklist

- ✅ Search with 300ms debouncing
- ✅ Sort by date/status/ID
- ✅ Pagination (10/25/50 per page)
- ✅ Multi-select with bulk operations
- ✅ Status validation & immutability
- ✅ Concurrency protection
- ✅ Atomic bulk transactions
- ✅ Professional visualizations
- ✅ No alert boxes
- ✅ Loading spinners
- ✅ Mobile responsive

---

## 🧪 Quick Test Workflow

### Test 1: Search Debouncing
1. Type "python" slowly (one letter at a time)
2. Notice only ONE API call after you stop typing
3. ✅ Debounce working

### Test 2: Pagination
1. Load candidates (10 per page)
2. Click "Next →" button
3. New candidates appear on page 2
4. ✅ Pagination working

### Test 3: Status Update
1. Click "Update" on any candidate
2. Try changing to invalid status
3. See error message (no alert)
4. ✅ Validation working

### Test 4: Bulk Operations
1. Select 3 candidates
2. Choose new status
3. Click "Update Selected"
4. All 3 update at once
5. ✅ Bulk operations working

---

## 📁 Excel File Format

Your Excel file must have exactly 2 sheets:

### Sheet 1: "JDs"
| JD_ID | Title | Must_Have_Skills | Nice_To_Have_Skills | Min_Years_Exp | Location | JD_Version | JD_Last_Updated |
|-------|-------|-----------------|-------------------|---------------|----------|-----------|-----------------|
| JD-1001 | Senior Python Developer | Python;Django;SQL | Docker;AWS | 5 | New York | 1 | 2025-01-01 |

### Sheet 2: "Candidates"
| Candidate_ID | Name | Email | JD_ID | Skills | Years_Exp | Location | Submission_Date | Current_Status | Interview_Round | Rejection_Reason | Notes |
|--------------|------|-------|-------|--------|-----------|----------|-----------------|-----------------|-----------------|------------------|-------|
| C-0001 | John Doe | john@example.com | JD-1001 | Python;SQL | 6 | New York | 2025-12-15 | Submitted | | | |

---

## 🔑 Status Transitions

Valid status changes:
```
Submitted
├── → Interviewing
├── → Accepted
└── → Rejected

Interviewing  
├── → Accepted
└── → Rejected

Rejected (FINAL - no changes)
Accepted (FINAL - no changes)
```

---

## 🎯 Common Tasks

### Find a Specific Candidate
1. Type name in search box
2. Wait 300ms (debounce)
3. Results filter automatically

### Match a Candidate Against JD
1. Enter Candidate ID in "Candidate Matching" section
2. Click "Show Match Details"
3. View score, progress bar, and breakdown

### Update Multiple Candidates at Once
1. Check boxes for candidates you want to update
2. Go to "Bulk Update Status"
3. Select new status
4. Click "Update Selected"

### Generate a Report
1. Go to "Reports & Analytics"
2. Enter JD ID (optional, leave blank for all)
3. Click "Generate Report"
4. View status distribution and submission trends

### Export Data (Download)
1. Reports can be copied to Excel
2. Table can be printed
3. Use browser's "Save as PDF" for archiving

---

## 🐛 Troubleshooting

### "Port 8000 already in use"
```bash
uvicorn app:app --port 8001
```

### "Excel import fails"
- Check file is .xlsx format
- Verify sheet names: "JDs" and "Candidates" (exact case)
- Ensure all required columns present
- Check for data formatting issues

### "Search not working"
- Verify data was imported successfully
- Check browser console for errors
- Wait 300ms after typing
- Try refreshing page

### "Buttons not responding"
- Check browser console for JavaScript errors
- Verify server is running
- Try hard refresh (Ctrl+Shift+R)

### "Database errors"
- Delete `recruitment_base.db` to reset
- Server will recreate on restart
- Re-import your data

---

## 📞 Help & Support

### View Logs
- Open browser DevTools (F12)
- Go to Console tab
- Look for error messages

### Check Status
- API responses logged in Network tab
- Database operations visible in terminal

### Reset Everything
```bash
# Stop server (Ctrl+C)
# Delete database
rm recruitment_base.db
# Restart
uvicorn app:app --reload --port 8000
```

---

## ⚡ Performance Tips

1. **Faster searches**: Use specific keywords
2. **Faster bulk updates**: Update in batches of 50 or fewer
3. **Faster reports**: Specify a JD ID instead of all
4. **Faster loading**: Limit page size to 25 for large datasets

---

## 🎓 Learning More

- See `README.md` for comprehensive documentation
- Check `BUG_FIXES_SUMMARY.md` for implementation details
- Review `TESTING_EVIDENCE.md` for test cases

---

**Happy recruiting! 🎉**

*Recruitment Management Dashboard v2.0*
