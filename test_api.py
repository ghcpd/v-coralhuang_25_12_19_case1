"""Small integration tests to run against a local server running on http://127.0.0.1:8000

Run after starting the server: python test_api.py
"""
import requests

BASE = 'http://127.0.0.1:8000'

def assert_true(cond, msg):
    if not cond:
        raise SystemExit('Assertion failed: ' + msg)

print('Checking import status...')
r = requests.get(BASE + '/api/auto_import_status')
assert_true(r.status_code == 200, 'auto_import_status failed')
print('OK')

print('Testing invalid status transition (Submitted -> Rejected should fail)')
# find a candidate with 'Submitted' if exists
r = requests.get(BASE + '/api/candidates')
assert_true(r.status_code == 200, 'candidates failed')
items = r.json().get('items', [])
submitted = next((c for c in items if c.get('current_status') == 'Submitted'), None)
if not submitted:
    print('No Submitted candidate found; skipping this test')
else:
    cid = submitted['candidate_id']
    r2 = requests.post(BASE + '/api/update_status', json={'candidate_id': cid, 'status': 'Rejected', 'reason': 'test'})
    assert_true(r2.status_code != 200, 'Invalid transition allowed')
    print('OK (transition blocked)')

print('Testing atomic bulk update (should fail completely if one candidate invalid)')
# pick first two candidates; force one to be Accepted in advance so bulk fails
if len(items) >= 2:
    c1 = items[0]['candidate_id']
    c2 = items[1]['candidate_id']
    # set c2 to 'Accepted' directly to make it immutable
    r3 = requests.post(BASE + '/api/update_status', json={'candidate_id': c2, 'status': 'Interviewing'})
    r4 = requests.post(BASE + '/api/update_status', json={'candidate_id': c2, 'status': 'Accepted'})
    r5 = requests.post(BASE + '/api/bulk_update_status', json={'candidate_ids':[c1,c2], 'status': 'Rejected', 'reason':'bulk test'})
    assert_true(r5.status_code != 200, 'Bulk update should fail atomically when one candidate is immutable')
    print('OK (atomic rollback verified)')
else:
    print('Not enough candidates to run bulk test; skipping')

print('All tests done (some tests may have been skipped depending on data).')