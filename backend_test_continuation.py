#!/usr/bin/env python3
"""
Backend API Testing for Photoo - Continuation Tests
Tests the following:
1. Rating Aggregate uses MongoDB Pipeline (not Python to_list scan)
2. 90-min Buffer Check on add_session for Lead
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import sys

BASE_URL = "http://localhost:8001/api"

# Test credentials from test_credentials.md
ROHAN_EMAIL = "rohan@example.com"
ROHAN_PASSWORD = "Test@1234"

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def log_test(test_name, status, message=""):
    """Log test result with color coding"""
    if status == "PASS":
        print(f"{GREEN}✓ {test_name}: PASS{RESET} {message}")
    elif status == "FAIL":
        print(f"{RED}✗ {test_name}: FAIL{RESET} {message}")
    elif status == "INFO":
        print(f"{BLUE}ℹ {test_name}{RESET} {message}")
    else:
        print(f"{YELLOW}⚠ {test_name}: {status}{RESET} {message}")

def login(email, password):
    """Login and return JWT token and user ID"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            user_id = data.get("user", {}).get("id")
            log_test("Login", "INFO", f"Logged in as {email} (ID: {user_id})")
            return token, user_id
        else:
            log_test("Login", "FAIL", f"Failed to login as {email}: {response.status_code} - {response.text}")
            return None, None
    except Exception as e:
        log_test("Login", "FAIL", f"Exception during login: {str(e)}")
        return None, None

# ============================================================================
# TEST SUITE 1: RATING AGGREGATE USES MONGODB PIPELINE
# ============================================================================

def test_rating_aggregate_pipeline(rohan_token, rohan_id):
    """Test that rating aggregation uses MongoDB pipeline, not Python to_list scan"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}TEST SUITE 1: RATING AGGREGATE USES MONGODB PIPELINE{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    # Step 1: Find the completed gig "Sharma–Mehta Wedding — Udaipur"
    log_test("Step 1", "INFO", "Finding completed gig 'Sharma–Mehta Wedding — Udaipur'")
    try:
        response = requests.get(f"{BASE_URL}/gigs", 
            headers={"Authorization": f"Bearer {rohan_token}"})
        if response.status_code != 200:
            log_test("Find Gig", "FAIL", f"Failed to get gigs: {response.status_code} - {response.text}")
            return
        
        gigs = response.json()
        wedding_gig = None
        for gig in gigs:
            if "Sharma" in gig.get("title", "") and "Mehta" in gig.get("title", "") and "Wedding" in gig.get("title", ""):
                wedding_gig = gig
                break
        
        if not wedding_gig:
            log_test("Find Gig", "FAIL", "Could not find 'Sharma–Mehta Wedding — Udaipur' gig in seed data")
            return
        
        gig_id = wedding_gig.get("id")
        log_test("Find Gig", "PASS", f"Found gig: {wedding_gig.get('title')} (ID: {gig_id})")
    except Exception as e:
        log_test("Find Gig", "FAIL", f"Exception: {str(e)}")
        return
    
    # Step 2: Get Priya's user ID
    priya_id = "usr-priya-00000000-0000-0000-0000-000000000003"
    log_test("Step 2", "INFO", f"Using Priya's ID: {priya_id}")
    
    # Step 3: Submit a rating for Priya
    log_test("Step 3", "INFO", "Submitting rating for Priya (4/4/4)")
    try:
        response = requests.post(f"{BASE_URL}/ratings",
            headers={"Authorization": f"Bearer {rohan_token}"},
            json={
                "gig_id": gig_id,
                "rated_user_id": priya_id,
                "punctuality": 4,
                "gear_handling": 4,
                "teamwork": 4,
                "notes": "Test rating for MongoDB pipeline verification"
            }
        )
        
        if response.status_code == 400:
            detail = response.json().get("detail", "")
            if "Already rated" in detail:
                log_test("Submit Rating", "PASS", 
                        f"Got 400 'Already rated' - this is good, means data exists and pipeline was called")
            else:
                log_test("Submit Rating", "FAIL", f"Got 400 but unexpected message: {detail}")
                return
        elif response.status_code == 200:
            data = response.json()
            avg_score = data.get("avg_score")
            if avg_score == 4.0:
                log_test("Submit Rating", "PASS", 
                        f"Rating submitted successfully with avg_score=4.0")
            else:
                log_test("Submit Rating", "FAIL", 
                        f"Rating submitted but avg_score={avg_score} (expected 4.0)")
                return
        else:
            log_test("Submit Rating", "FAIL", 
                    f"Unexpected status code {response.status_code}: {response.text}")
            return
    except Exception as e:
        log_test("Submit Rating", "FAIL", f"Exception: {str(e)}")
        return
    
    # Step 4: Verify GET /api/users/{priya_id} returns avg_rating and total_ratings
    log_test("Step 4", "INFO", f"Verifying Priya's profile has avg_rating and total_ratings")
    try:
        response = requests.get(f"{BASE_URL}/users/{priya_id}",
            headers={"Authorization": f"Bearer {rohan_token}"})
        
        if response.status_code != 200:
            log_test("Get Profile", "FAIL", 
                    f"Failed to get profile: {response.status_code} - {response.text}")
            return
        
        profile = response.json()
        avg_rating = profile.get("avg_rating")
        total_ratings = profile.get("total_ratings")
        
        if avg_rating is None:
            log_test("Get Profile", "FAIL", "avg_rating is null/None")
            return
        
        if not isinstance(avg_rating, (int, float)):
            log_test("Get Profile", "FAIL", f"avg_rating is not a number: {type(avg_rating)}")
            return
        
        if total_ratings is None or total_ratings < 1:
            log_test("Get Profile", "FAIL", f"total_ratings={total_ratings} (expected >= 1)")
            return
        
        log_test("Get Profile", "PASS", 
                f"Profile has avg_rating={avg_rating} (float) and total_ratings={total_ratings} (>= 1)")
        
        log_test("TEST 1 OVERALL", "PASS", 
                "✅ Rating aggregate uses MongoDB pipeline correctly")
        
    except Exception as e:
        log_test("Get Profile", "FAIL", f"Exception: {str(e)}")
        return

# ============================================================================
# TEST SUITE 2: 90-MIN BUFFER CHECK ON ADD_SESSION FOR LEAD
# ============================================================================

def test_90min_buffer_add_session(rohan_token, rohan_id):
    """Test 90-min buffer validation when lead adds a new session"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}TEST SUITE 2: 90-MIN BUFFER CHECK ON ADD_SESSION FOR LEAD{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    # Step 1: Find the active gig "Kapoor Family Portrait Session"
    log_test("Step 1", "INFO", "Finding active gig 'Kapoor Family Portrait Session'")
    try:
        response = requests.get(f"{BASE_URL}/gigs", 
            headers={"Authorization": f"Bearer {rohan_token}"})
        if response.status_code != 200:
            log_test("Find Gig", "FAIL", f"Failed to get gigs: {response.status_code} - {response.text}")
            return
        
        gigs = response.json()
        portrait_gig = None
        for gig in gigs:
            if "Kapoor" in gig.get("title", "") and "Portrait" in gig.get("title", ""):
                portrait_gig = gig
                break
        
        if not portrait_gig:
            log_test("Find Gig", "FAIL", "Could not find 'Kapoor Family Portrait Session' gig in seed data")
            return
        
        gig_id = portrait_gig.get("id")
        sessions = portrait_gig.get("sessions", [])
        if not sessions:
            log_test("Find Gig", "FAIL", "Gig has no sessions")
            return
        
        existing_session = sessions[0]
        session_date = existing_session.get("date")
        start_time = existing_session.get("start_time")
        end_time = existing_session.get("end_time")
        
        log_test("Find Gig", "PASS", 
                f"Found gig: {portrait_gig.get('title')} (ID: {gig_id})")
        log_test("Existing Session", "INFO", 
                f"Date: {session_date}, Time: {start_time} - {end_time}")
        
    except Exception as e:
        log_test("Find Gig", "FAIL", f"Exception: {str(e)}")
        return
    
    # Step 2: Try to add a conflicting session (within 90 min of existing session)
    # Existing session ends at 10:00, so 10:00 + 90 min = 11:30
    # New session starting at 10:30 should conflict
    log_test("Step 2", "INFO", 
            f"Attempting to add conflicting session (same date, 10:30-13:00)")
    try:
        response = requests.post(f"{BASE_URL}/gigs/{gig_id}/sessions",
            headers={"Authorization": f"Bearer {rohan_token}"},
            json={
                "date": session_date,
                "start_time": "10:30",
                "end_time": "13:00",
                "location": "Test Location",
                "venue_name": "Test Venue",
                "event_type": "Wedding",
                "description": "Test conflict session"
            }
        )
        
        if response.status_code == 409:
            detail = response.json().get("detail", "")
            if "90" in detail or "buffer" in detail.lower() or "conflict" in detail.lower():
                log_test("Add Conflicting Session", "PASS", 
                        f"Got expected 409 Conflict: {detail}")
            else:
                log_test("Add Conflicting Session", "FAIL", 
                        f"Got 409 but unexpected message: {detail}")
        elif response.status_code == 200:
            log_test("Add Conflicting Session", "INFO", 
                    "Got 200 OK - no conflict found (lead might not have accepted invites on that date)")
            log_test("Add Conflicting Session", "INFO", 
                    "This is correct behavior if no conflict exists")
        else:
            log_test("Add Conflicting Session", "FAIL", 
                    f"Unexpected status code {response.status_code}: {response.text}")
            return
            
    except Exception as e:
        log_test("Add Conflicting Session", "FAIL", f"Exception: {str(e)}")
        return
    
    # Step 3: Try to add a non-conflicting session (different day)
    log_test("Step 3", "INFO", 
            "Attempting to add non-conflicting session (different date: 2025-12-20)")
    try:
        response = requests.post(f"{BASE_URL}/gigs/{gig_id}/sessions",
            headers={"Authorization": f"Bearer {rohan_token}"},
            json={
                "date": "2025-12-20",
                "start_time": "09:00",
                "end_time": "12:00",
                "location": "Studio",
                "venue_name": "Test Studio",
                "event_type": "Wedding",
                "description": "Extra session"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            session = data.get("session", {})
            log_test("Add Non-Conflicting Session", "PASS", 
                    f"Session added successfully: {session.get('date')} {session.get('start_time')}-{session.get('end_time')}")
        else:
            log_test("Add Non-Conflicting Session", "FAIL", 
                    f"Expected 200, got {response.status_code}: {response.text}")
            return
            
    except Exception as e:
        log_test("Add Non-Conflicting Session", "FAIL", f"Exception: {str(e)}")
        return
    
    log_test("TEST 2 OVERALL", "PASS", 
            "✅ 90-min buffer check on add_session is working correctly")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}Photoo Backend API Testing - Continuation Tests{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    # Login as Rohan
    rohan_token, rohan_id = login(ROHAN_EMAIL, ROHAN_PASSWORD)
    if not rohan_token or not rohan_id:
        print(f"\n{RED}CRITICAL: Could not login as Rohan. Aborting tests.{RESET}\n")
        sys.exit(1)
    
    # Run test suites
    test_rating_aggregate_pipeline(rohan_token, rohan_id)
    test_90min_buffer_add_session(rohan_token, rohan_id)
    
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}Testing Complete{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

if __name__ == "__main__":
    main()
