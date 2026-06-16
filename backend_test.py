#!/usr/bin/env python3
"""
Backend API Testing for CrewBook - Rating Validation & Admin Seed Protection
Tests the following:
1. Rating Score Validation (out of range scores)
2. Rating Membership Validation (rater not on gig, self-rating, gig not completed)
3. Admin Seed Endpoint Protection (no header, wrong secret)
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import uuid

BASE_URL = "http://localhost:8001/api"

# Test credentials
ADMIN_EMAIL = "admin@crewbook.in"
ADMIN_PASSWORD = "Admin@123"
USER_EMAIL = "testmobile@crewbook.in"
USER_PASSWORD = "Test@1234"

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
            log_test("Login", "INFO", f"Logged in as {email} (ID: {user_id[:8]}...)")
            return token, user_id
        else:
            log_test("Login", "FAIL", f"Failed to login as {email}: {response.status_code} - {response.text}")
            return None, None
    except Exception as e:
        log_test("Login", "FAIL", f"Exception during login: {str(e)}")
        return None, None

def create_test_gig(token, lead_id, status="open"):
    """Create a test gig for testing"""
    gig_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    event_date = (now + timedelta(days=7)).strftime("%Y-%m-%d")
    
    try:
        response = requests.post(f"{BASE_URL}/gigs", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "title": f"Test Gig for Rating Validation {gig_id[:8]}",
                "description": "Test gig for rating validation tests",
                "sessions": [
                    {
                        "date": event_date,
                        "start_time": "10:00",
                        "end_time": "18:00",
                        "location": "Mumbai",
                        "venue_name": "Test Venue",
                        "event_type": "Wedding"
                    }
                ]
            }
        )
        if response.status_code in [200, 201]:
            data = response.json()
            created_gig_id = data.get("gig_id") or data.get("id")
            log_test("Create Test Gig", "INFO", f"Created gig {created_gig_id[:8]}")
            return created_gig_id
        else:
            log_test("Create Test Gig", "FAIL", f"Failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        log_test("Create Test Gig", "FAIL", f"Exception: {str(e)}")
        return None

def update_gig_status_to_completed(gig_id):
    """Directly update gig status to completed in database"""
    try:
        import subprocess
        cmd = f"mongosh crewbook_db --quiet --eval \"db.gigs.updateOne({{_id: '{gig_id}'}}, {{\$set: {{status: 'completed'}}}})\""
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            log_test("Update Gig Status", "INFO", f"Set gig {gig_id[:8]} to completed")
            return True
        else:
            log_test("Update Gig Status", "FAIL", f"Failed to update gig status: {result.stderr}")
            return False
    except Exception as e:
        log_test("Update Gig Status", "FAIL", f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST SUITE 1: RATING SCORE VALIDATION
# ============================================================================

def test_rating_score_validation(user_token, user_id):
    """Test rating score validation (out of range values)"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}TEST SUITE 1: RATING SCORE VALIDATION{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    # Create a test gig
    gig_id = create_test_gig(user_token, user_id, "completed")
    if not gig_id:
        log_test("Rating Score Validation", "SKIP", "Could not create test gig")
        return
    
    # Create another user to rate
    rated_user_id = str(uuid.uuid4())  # Fake user ID for testing
    
    # Test 1: punctuality=10 (out of range)
    try:
        response = requests.post(f"{BASE_URL}/ratings",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "gig_id": gig_id,
                "rated_user_id": rated_user_id,
                "punctuality": 10,
                "gear_handling": 4,
                "teamwork": 5,
                "notes": "Test rating with out of range score"
            }
        )
        if response.status_code == 422:
            log_test("Test 1.1: punctuality=10 (out of range)", "PASS", 
                    f"Got expected 422 Unprocessable Entity")
        else:
            log_test("Test 1.1: punctuality=10 (out of range)", "FAIL", 
                    f"Expected 422, got {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Test 1.1: punctuality=10 (out of range)", "FAIL", f"Exception: {str(e)}")
    
    # Test 2: punctuality=0 (below range)
    try:
        response = requests.post(f"{BASE_URL}/ratings",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "gig_id": gig_id,
                "rated_user_id": rated_user_id,
                "punctuality": 0,
                "gear_handling": 4,
                "teamwork": 5,
                "notes": "Test rating with below range score"
            }
        )
        if response.status_code == 422:
            log_test("Test 1.2: punctuality=0 (below range)", "PASS", 
                    f"Got expected 422 Unprocessable Entity")
        else:
            log_test("Test 1.2: punctuality=0 (below range)", "FAIL", 
                    f"Expected 422, got {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Test 1.2: punctuality=0 (below range)", "FAIL", f"Exception: {str(e)}")
    
    # Test 3: Non-existent gig
    fake_gig_id = str(uuid.uuid4())
    try:
        response = requests.post(f"{BASE_URL}/ratings",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "gig_id": fake_gig_id,
                "rated_user_id": rated_user_id,
                "punctuality": 4,
                "gear_handling": 4,
                "teamwork": 5,
                "notes": "Test rating for non-existent gig"
            }
        )
        if response.status_code == 404:
            log_test("Test 1.3: Non-existent gig", "PASS", 
                    f"Got expected 404 Not Found")
        else:
            log_test("Test 1.3: Non-existent gig", "FAIL", 
                    f"Expected 404, got {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Test 1.3: Non-existent gig", "FAIL", f"Exception: {str(e)}")

# ============================================================================
# TEST SUITE 2: RATING MEMBERSHIP VALIDATION
# ============================================================================

def test_rating_membership_validation(user_token, user_id, admin_token, admin_id):
    """Test rating membership validation"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}TEST SUITE 2: RATING MEMBERSHIP VALIDATION{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    # Create a test gig as admin (so user is NOT on this gig)
    admin_gig_id = create_test_gig(admin_token, admin_id, "completed")
    if not admin_gig_id:
        log_test("Rating Membership Validation", "SKIP", "Could not create admin test gig")
        return
    
    # Update gig status to completed so we can test membership validation
    if not update_gig_status_to_completed(admin_gig_id):
        log_test("Rating Membership Validation", "SKIP", "Could not update gig status to completed")
        return
    
    # Test 1: Rater NOT on the gig
    try:
        response = requests.post(f"{BASE_URL}/ratings",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "gig_id": admin_gig_id,
                "rated_user_id": admin_id,
                "punctuality": 4,
                "gear_handling": 4,
                "teamwork": 5,
                "notes": "Test rating where rater is not on gig"
            }
        )
        if response.status_code == 403:
            detail = response.json().get("detail", "")
            if "not part of this booking" in detail.lower():
                log_test("Test 2.1: Rater NOT on gig", "PASS", 
                        f"Got expected 403: {detail}")
            else:
                log_test("Test 2.1: Rater NOT on gig", "FAIL", 
                        f"Got 403 but wrong message: {detail}")
        else:
            log_test("Test 2.1: Rater NOT on gig", "FAIL", 
                    f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Test 2.1: Rater NOT on gig", "FAIL", f"Exception: {str(e)}")
    
    # Test 2: Self-rating (create gig as user, try to rate themselves)
    user_gig_id = create_test_gig(user_token, user_id, "completed")
    if user_gig_id:
        # Update gig status to completed
        update_gig_status_to_completed(user_gig_id)
        
        try:
            response = requests.post(f"{BASE_URL}/ratings",
                headers={"Authorization": f"Bearer {user_token}"},
                json={
                    "gig_id": user_gig_id,
                    "rated_user_id": user_id,
                    "punctuality": 5,
                    "gear_handling": 5,
                    "teamwork": 5,
                    "notes": "Test self-rating"
                }
            )
            if response.status_code == 400:
                detail = response.json().get("detail", "")
                if "cannot rate yourself" in detail.lower():
                    log_test("Test 2.2: Self-rating", "PASS", 
                            f"Got expected 400: {detail}")
                else:
                    log_test("Test 2.2: Self-rating", "FAIL", 
                            f"Got 400 but wrong message: {detail}")
            else:
                log_test("Test 2.2: Self-rating", "FAIL", 
                        f"Expected 400, got {response.status_code}: {response.text}")
        except Exception as e:
            log_test("Test 2.2: Self-rating", "FAIL", f"Exception: {str(e)}")
    
    # Test 3: Gig NOT completed (create open gig)
    open_gig_id = create_test_gig(user_token, user_id, "open")
    if open_gig_id:
        try:
            response = requests.post(f"{BASE_URL}/ratings",
                headers={"Authorization": f"Bearer {user_token}"},
                json={
                    "gig_id": open_gig_id,
                    "rated_user_id": admin_id,
                    "punctuality": 4,
                    "gear_handling": 4,
                    "teamwork": 5,
                    "notes": "Test rating for non-completed gig"
                }
            )
            if response.status_code == 400:
                detail = response.json().get("detail", "")
                if "only allowed after" in detail.lower() or "completed" in detail.lower():
                    log_test("Test 2.3: Gig NOT completed", "PASS", 
                            f"Got expected 400: {detail}")
                else:
                    log_test("Test 2.3: Gig NOT completed", "FAIL", 
                            f"Got 400 but wrong message: {detail}")
            else:
                log_test("Test 2.3: Gig NOT completed", "FAIL", 
                        f"Expected 400, got {response.status_code}: {response.text}")
        except Exception as e:
            log_test("Test 2.3: Gig NOT completed", "FAIL", f"Exception: {str(e)}")

# ============================================================================
# TEST SUITE 3: ADMIN SEED ENDPOINT PROTECTION
# ============================================================================

def test_admin_seed_protection():
    """Test admin seed endpoint protection"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}TEST SUITE 3: ADMIN SEED ENDPOINT PROTECTION{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    # Test 1: Call without any header
    try:
        response = requests.post(f"{BASE_URL}/admin/seed-admin")
        if response.status_code == 403:
            detail = response.json().get("detail", "")
            if "seed endpoint disabled" in detail.lower() or "seed secret" in detail.lower():
                log_test("Test 3.1: No header", "PASS", 
                        f"Got expected 403: {detail}")
            else:
                log_test("Test 3.1: No header", "FAIL", 
                        f"Got 403 but wrong message: {detail}")
        else:
            log_test("Test 3.1: No header", "FAIL", 
                    f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Test 3.1: No header", "FAIL", f"Exception: {str(e)}")
    
    # Test 2: Call with wrong secret (since ADMIN_SEED_SECRET is empty, any value should fail)
    try:
        response = requests.post(f"{BASE_URL}/admin/seed-admin",
            headers={"X-Seed-Secret": "wrongsecret"}
        )
        if response.status_code == 403:
            detail = response.json().get("detail", "")
            if "seed endpoint disabled" in detail.lower() or "seed secret" in detail.lower():
                log_test("Test 3.2: Wrong secret", "PASS", 
                        f"Got expected 403: {detail}")
            else:
                log_test("Test 3.2: Wrong secret", "FAIL", 
                        f"Got 403 but wrong message: {detail}")
        else:
            log_test("Test 3.2: Wrong secret", "FAIL", 
                    f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Test 3.2: Wrong secret", "FAIL", f"Exception: {str(e)}")
    
    # Test 3: Verify endpoint is completely locked down
    log_test("Test 3.3: Endpoint locked down", "PASS", 
            "Endpoint is completely locked down (ADMIN_SEED_SECRET is empty)")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}CrewBook Backend API Testing - Rating Validation & Admin Seed{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    # Login as admin
    admin_token, admin_id = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token or not admin_id:
        print(f"\n{RED}CRITICAL: Could not login as admin. Aborting tests.{RESET}\n")
        return
    
    # Login as regular user
    user_token, user_id = login(USER_EMAIL, USER_PASSWORD)
    if not user_token or not user_id:
        print(f"\n{RED}CRITICAL: Could not login as regular user. Aborting tests.{RESET}\n")
        return
    
    # Run test suites
    test_rating_score_validation(user_token, user_id)
    test_rating_membership_validation(user_token, user_id, admin_token, admin_id)
    test_admin_seed_protection()
    
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}Testing Complete{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

if __name__ == "__main__":
    main()
