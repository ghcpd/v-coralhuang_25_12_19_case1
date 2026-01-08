# Recruitment Management Dashboard

A production-quality recruitment management dashboard built with HTML, CSS, JavaScript, and FastAPI.

## Features

- **Candidate Management**: View, search, sort, and paginate candidates
- **Status Management**: Update candidate statuses with validation and audit trail
- **Bulk Operations**: Select and update multiple candidates at once
- **Match Analysis**: Analyze candidate-job fit with detailed scoring
- **Reports**: Visual charts for status distribution and submission trends
- **Excel Import**: Import candidate and job data from Excel files

## Installation

### Prerequisites

- Python 3.8+
- pip

### Setup

1. Clone or download the project files
2. Install dependencies:
   ```bash
   pip install fastapi uvicorn pandas openpyxl
   ```

3. Run the application:
   ```bash
   uvicorn app:app --reload --port 8000
   ```

4. Open your browser to `http://127.0.0.1:8000/`

## Usage

### Importing Data

1. Prepare an Excel file with two sheets: `JDs` and `Candidates`
2. Use the file upload to import the data
3. The application will automatically load sample data on first run

### Managing Candidates

- **Search**: Type in the search box to filter by name, email, or skills (debounced 300ms)
- **Sort**: Use the dropdown to sort by date, status, or ID
- **Paginate**: Use prev/next buttons and page size selector
- **Select**: Check boxes to select candidates for bulk operations
- **Update Status**: Click "Update" on a candidate or use bulk update

### Status Transitions

Valid status transitions:
- Submitted → Interviewing → Rejected/Accepted
- Status becomes immutable once Rejected or Accepted

### Reports

Load reports to see:
- Status distribution charts
- Submission trend visualizations

## Bug Fixes and Improvements

### Backend Fixes

1. **Status Validation**: Added proper validation for status transitions. Prevents invalid moves like Rejected → Submitted and blocks changes to final statuses.

2. **Duplicate Prevention**: Checks if status update would result in no change and blocks it.

3. **Concurrency Control**: Uses database transactions to prevent race conditions during updates.

4. **Bulk Operations**: Made bulk updates atomic using transactions - all succeed or all fail.

5. **Database Indexes**: Added indexes on frequently queried columns for performance.

### Frontend Fixes

1. **Debounced Search**: Implemented 300ms debounce to prevent excessive API calls.

2. **Pagination**: Full pagination with page size selection and proper navigation.

3. **Bulk Selection**: Working select all/deselect all and individual selection with count display.

4. **Loading States**: Shows spinners during async operations and disables buttons to prevent duplicate clicks.

5. **Error Handling**: Replaced `alert()` with inline error messages.

6. **Data Formatting**: 
   - Dates formatted as "Dec 19, 2025"
   - Skills displayed as comma-separated tags instead of semicolons
   - Status badges with color coding

7. **Empty States**: Friendly messages when no data is available.

8. **UI Redesign**: Cleaner button layout with grouped actions and better visual hierarchy.

### Data Display Improvements

- **Reports**: Visual bar charts instead of raw JSON
- **Match Results**: Progress bars for scores, formatted skill displays
- **Status Badges**: Color-coded pills (blue/yellow/red/green)

## API Endpoints

- `GET /`: Main dashboard page
- `POST /api/import`: Import Excel data
- `GET /api/candidates`: List candidates with search/sort/pagination
- `GET /api/report`: Get status reports and trends
- `GET /api/match/{candidate_id}`: Match candidate to job
- `POST /api/update_status`: Update single candidate status
- `POST /api/bulk_update_status`: Update multiple candidates

## Architecture

- **Backend**: FastAPI with SQLite database
- **Frontend**: Vanilla JavaScript with modern async/await
- **Styling**: Clean CSS with responsive design
- **Data**: Excel import with pandas, stored in SQLite

## Security Considerations

- Input validation on all endpoints
- SQL injection prevention with parameterized queries
- Transaction safety for data integrity
- No authentication implemented (add as needed for production)

## Performance

- Database indexes for fast queries
- Pagination to handle large datasets
- Debounced search to reduce API calls
- Efficient DOM updates

## Future Enhancements

- User authentication and authorization
- Real-time updates with WebSockets
- Advanced filtering options
- Export functionality
- Email notifications
- Audit log viewing interface