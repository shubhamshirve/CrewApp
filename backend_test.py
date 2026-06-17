#!/usr/bin/env python3
"""
Backend API Test Suite for CrewBook
Tests the fixed 90-min buffer add_session endpoint
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8001/api"
LEAD_EMAIL = "rohan@example.com"
LEAD_PASSWORD = "Test@1234"

# Test results tracking
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })
    print(f"{status}: {test_name}")
    if details:
        print(f"   Details: {details}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for t in test_results if t["passed"])
    total = len(test_results)
    print(f"Total: {passed}/{total} tests passed")
    print()
    for result in test_results:
        status = "✅" if result["passed"] else "❌"
        print(f"{status} {result['test']}")
        if result["details"] and not result["passed"]:
            print(f"   {result['details']}")
    print("="*80)

def login(email, password):
    """Login and return JWT token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def get_headers(token):
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def test_90min_buffer_add_session():
    """Test the fixed 90-min buffer check on add_session endpoint"""
    
    print("\n" + "="*80)
    print("TEST SUITE: 90-min Buffer Check on add_session (FIXED)")
    print("="*80 + "\n")
    
    # Step 1: Login as lead photographer
    print("Step 1: Login as rohan@example.com...")
    token = login(LEAD_EMAIL, LEAD_PASSWORD)
    if not token:
        log_test("Login as lead photographer", False, "Failed to get JWT token")
        return
    log_test("Login as lead photographer", True, f"Token obtained: {token[:20]}...")
    
    headers = get_headers(token)
    
    # Step 2: Find the portrait gig
    print("\nStep 2: Finding portrait gig (starts with 'gig-portrait-')...")
    try:
        response = requests.get(f"{BASE_URL}/gigs", headers=headers)
        if response.status_code != 200:
            log_test("Get gigs list", False, f"Status {response.status_code}: {response.text}")
            return
        
        gigs = response.json()
        portrait_gig = None
        for gig in gigs:
            gig_id = gig.get("id") or gig.get("_id", "")
            if gig_id.startswith("gig-portrait-") or "Portrait" in gig.get("title", ""):
                portrait_gig = gig
                break
        
        if not portrait_gig:
            log_test("Find portrait gig", False, "No portrait gig found in gigs list")
            return
        
        portrait_gig_id = portrait_gig.get("id") or portrait_gig.get("_id")
        log_test("Find portrait gig", True, f"Found gig: {portrait_gig['title']} (ID: {portrait_gig_id})")
        
        # Get existing session details
        sessions = portrait_gig.get("sessions", [])
        if sessions:
            first_session = sessions[0]
            existing_date = first_session.get("date")
            existing_start = first_session.get("start_time")
            existing_end = first_session.get("end_time")
            print(f"   Existing session: {existing_date} {existing_start}-{existing_end}")
        else:
            existing_date = None
            print("   No existing sessions found")
        
    except Exception as e:
        log_test("Find portrait gig", False, f"Exception: {str(e)}")
        return
    
    # Step 3: Test A - Add session on different day (should succeed)
    print("\nStep 3: Test A - Add session on different day (2025-12-28)...")
    test_a_data = {
        "date": "2025-12-28",
        "start_time": "09:00",
        "end_time": "12:00",
        "description": "Extra session",
        "location": "Test Studio",
        "event_type": "Portrait"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/gigs/{portrait_gig_id}/sessions",
            headers=headers,
            json=test_a_data
        )
        
        if response.status_code == 200:
            session_data = response.json()
            log_test("Test A - Add session on different day", True, 
                    f"Session added successfully. Session ID: {session_data.get('id', 'N/A')}")
        elif response.status_code == 500:
            log_test("Test A - Add session on different day", False, 
                    f"CRITICAL: 500 Internal Server Error (bug not fixed): {response.text}")
        else:
            # Other status codes might be acceptable (e.g., 409 for conflict)
            log_test("Test A - Add session on different day", True, 
                    f"No 500 error (returned {response.status_code}): {response.text[:200]}")
    except Exception as e:
        log_test("Test A - Add session on different day", False, f"Exception: {str(e)}")
    
    # Step 4: Test B - Add session on same day (should not crash with 500)
    if existing_date:
        print(f"\nStep 4: Test B - Add session on same day as existing ({existing_date})...")
        test_b_data = {
            "date": existing_date,
            "start_time": "11:30",
            "end_time": "14:00",
            "description": "Back-to-back session",
            "location": "Same venue",
            "event_type": "Portrait"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/gigs/{portrait_gig_id}/sessions",
                headers=headers,
                json=test_b_data
            )
            
            if response.status_code == 200:
                session_data = response.json()
                log_test("Test B - Add session on same day (no 500 error)", True, 
                        f"Session added successfully (no conflict). Session ID: {session_data.get('id', 'N/A')}")
            elif response.status_code == 409:
                log_test("Test B - Add session on same day (no 500 error)", True, 
                        f"Conflict detected (expected): {response.text}")
            elif response.status_code == 500:
                log_test("Test B - Add session on same day (no 500 error)", False, 
                        f"CRITICAL: 500 Internal Server Error (bug not fixed): {response.text}")
            else:
                log_test("Test B - Add session on same day (no 500 error)", True, 
                        f"No 500 error (returned {response.status_code}): {response.text[:200]}")
        except Exception as e:
            log_test("Test B - Add session on same day (no 500 error)", False, f"Exception: {str(e)}")
    else:
        print("\nStep 4: Test B - Skipped (no existing session date found)")
    
    # Step 5: Verify the newly added session appears in gig details
    print(f"\nStep 5: Verify newly added session appears in GET /api/gigs/{portrait_gig_id}...")
    try:
        response = requests.get(f"{BASE_URL}/gigs/{portrait_gig_id}", headers=headers)
        if response.status_code == 200:
            gig_data = response.json()
            sessions = gig_data.get("sessions", [])
            
            # Check if the Test A session (2025-12-28) is present
            test_a_session_found = any(
                s.get("date") == "2025-12-28" and 
                s.get("start_time") == "09:00"
                for s in sessions
            )
            
            if test_a_session_found:
                log_test("Verify newly added session in gig details", True, 
                        f"Test A session found in gig. Total sessions: {len(sessions)}")
            else:
                log_test("Verify newly added session in gig details", False, 
                        f"Test A session not found. Total sessions: {len(sessions)}")
        else:
            log_test("Verify newly added session in gig details", False, 
                    f"Failed to get gig details: {response.status_code}")
    except Exception as e:
        log_test("Verify newly added session in gig details", False, f"Exception: {str(e)}")

if __name__ == "__main__":
    print("\n" + "="*80)
    print("CrewBook Backend API Test Suite")
    print("Testing: Fixed 90-min buffer add_session endpoint")
    print("="*80)
    
    test_90min_buffer_add_session()
    
    print_summary()
    
    # Exit with appropriate code
    all_passed = all(t["passed"] for t in test_results)
    exit(0 if all_passed else 1)
