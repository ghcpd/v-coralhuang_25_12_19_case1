import requests
import sys

BASE = 'http://127.0.0.1:8000'

def test_candidates_pagination():
    r = requests.get(BASE + '/api/candidates?page=1&page_size=2')
    assert r.status_code == 200
    j = r.json()
    assert 'items' in j and j['page_size'] == 2

def test_invalid_transition_blocked():
    # Choose a candidate that is Rejected (from template C-0003)
    payload = { 'candidate_id': 'C-0003', 'status': 'Submitted', 'reason': 'err' }
    r = requests.post(BASE + '/api/update_status', json=payload)
    assert r.status_code == 400

def test_bulk_atomicity():
    # Attempt to set mixed candidates including a Rejected one -> should fail
    payload = { 'candidate_ids': ['C-0001','C-0003'], 'status': 'Interviewing', 'reason': 'batch' }
    r = requests.post(BASE + '/api/bulk_update_status', json=payload)
    assert r.status_code == 400

if __name__ == '__main__':
    for f in [test_candidates_pagination, test_invalid_transition_blocked, test_bulk_atomicity]:
        try:
            f()
            print(f"{f.__name__}: OK")
        except AssertionError as e:
            print(f"{f.__name__}: FAIL", file=sys.stderr)
            raise
