#!/usr/bin/env python3
"""
Backend Test Script for AI Gear Validation Feature
Tests: Validate by AI button + scheduled cron sweep for pending gear submissions
"""
import requests
import json
import time
from typing import Dict, Optional

# Configuration
BASE_URL = "http://localhost:8001/api"
ADMIN_EMAIL = "admin@photoo.in"
ADMIN_PASSWORD = "Admin@123"
USER_EMAIL = "rohan@example.com"
USER_PASSWORD = "Test@1234"

# Test state
admin_token = None
user_token = None
test_submission_ids = []


def log_test(test_name: str, status: str, details: str = ""):
    """Log test results with formatting"""
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "ℹ️"
    print(f"\n{status_symbol} {test_name}")
    if details:
        print(f"   {details}")


def login(email: str, password: str) -> Optional[str]:
    """Login and return JWT token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            token = response.json().get("token")
            log_test(f"Login as {email}", "PASS", f"Token: {token[:20]}...")
            return token
        else:
            log_test(f"Login as {email}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test(f"Login as {email}", "FAIL", f"Exception: {str(e)}")
        return None


def get_platform_settings(token: str) -> Dict:
    """Get platform settings"""
    try:
        response = requests.get(
            f"{BASE_URL}/platform/settings",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            data = response.json()
            ai_enabled = data.get("ai_gear_validation_enabled", False)
            log_test("GET /api/platform/settings", "PASS", 
                    f"ai_gear_validation_enabled={ai_enabled}")
            return data
        else:
            log_test("GET /api/platform/settings", "FAIL", 
                    f"Status: {response.status_code}")
            return {}
    except Exception as e:
        log_test("GET /api/platform/settings", "FAIL", f"Exception: {str(e)}")
        return {}


def update_platform_settings(token: str, ai_gear_validation_enabled: bool) -> bool:
    """Update platform settings"""
    try:
        response = requests.put(
            f"{BASE_URL}/platform/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"ai_gear_validation_enabled": ai_gear_validation_enabled}
        )
        if response.status_code == 200:
            log_test(f"PUT /api/platform/settings (ai_gear_validation_enabled={ai_gear_validation_enabled})", 
                    "PASS", f"Updated successfully")
            return True
        else:
            log_test(f"PUT /api/platform/settings", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test(f"PUT /api/platform/settings", "FAIL", f"Exception: {str(e)}")
        return False


def submit_custom_gear(token: str, name: str, category: str, brand: Optional[str] = None) -> Optional[Dict]:
    """Submit custom gear and return submission data"""
    try:
        payload = {"name": name, "category": category}
        if brand:
            payload["brand"] = brand
        
        response = requests.post(
            f"{BASE_URL}/platform/gear-submissions",
            headers={"Authorization": f"Bearer {token}"},
            json=payload
        )
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            submission_id = data.get("id")
            log_test(f"POST /api/platform/gear-submissions ('{name}')", "PASS", 
                    f"ID: {submission_id}, Status: {status}")
            return data
        else:
            log_test(f"POST /api/platform/gear-submissions ('{name}')", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test(f"POST /api/platform/gear-submissions ('{name}')", "FAIL", 
                f"Exception: {str(e)}")
        return None


def get_pending_submissions(token: str) -> list:
    """Get all pending gear submissions"""
    try:
        response = requests.get(
            f"{BASE_URL}/platform/gear-submissions",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            log_test("GET /api/platform/gear-submissions", "PASS", 
                    f"Found {len(items)} pending submissions")
            return items
        else:
            log_test("GET /api/platform/gear-submissions", "FAIL", 
                    f"Status: {response.status_code}")
            return []
    except Exception as e:
        log_test("GET /api/platform/gear-submissions", "FAIL", f"Exception: {str(e)}")
        return []


def validate_submission_with_ai(token: str, submission_id: str, expect_status: int = 200) -> Optional[Dict]:
    """Call validate-ai endpoint on a submission"""
    try:
        response = requests.post(
            f"{BASE_URL}/platform/gear-submissions/{submission_id}/validate-ai",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == expect_status:
            if response.status_code == 200:
                data = response.json()
                decision = data.get("decision")
                confidence = data.get("ai_confidence")
                log_test(f"POST /api/platform/gear-submissions/{submission_id}/validate-ai", 
                        "PASS", f"Decision: {decision}, Confidence: {confidence}")
                return data
            else:
                log_test(f"POST /api/platform/gear-submissions/{submission_id}/validate-ai", 
                        "PASS", f"Expected {expect_status}, got {response.status_code}: {response.text}")
                return {"status_code": response.status_code, "detail": response.json().get("detail", "")}
        else:
            log_test(f"POST /api/platform/gear-submissions/{submission_id}/validate-ai", 
                    "FAIL", f"Expected {expect_status}, got {response.status_code}: {response.text}")
            return None
    except Exception as e:
        log_test(f"POST /api/platform/gear-submissions/{submission_id}/validate-ai", 
                "FAIL", f"Exception: {str(e)}")
        return None


def run_sweep(token: str, expect_status: int = 200) -> Optional[Dict]:
    """Call run-sweep endpoint"""
    try:
        response = requests.post(
            f"{BASE_URL}/platform/gear-submissions/run-sweep",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == expect_status:
            data = response.json()
            if data.get("skipped"):
                log_test("POST /api/platform/gear-submissions/run-sweep", "PASS", 
                        f"Skipped: {data.get('reason')}")
            else:
                log_test("POST /api/platform/gear-submissions/run-sweep", "PASS", 
                        f"Total: {data.get('total')}, Approved: {data.get('approved')}, Rejected: {data.get('rejected')}")
            return data
        else:
            log_test("POST /api/platform/gear-submissions/run-sweep", "FAIL", 
                    f"Expected {expect_status}, got {response.status_code}: {response.text}")
            return None
    except Exception as e:
        log_test("POST /api/platform/gear-submissions/run-sweep", "FAIL", 
                f"Exception: {str(e)}")
        return None


def main():
    global admin_token, user_token, test_submission_ids
    
    print("=" * 80)
    print("AI GEAR VALIDATION FEATURE TEST")
    print("=" * 80)
    
    # ========== SETUP ==========
    print("\n" + "=" * 80)
    print("SETUP")
    print("=" * 80)
    
    # Login as admin
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("\n❌ CRITICAL: Admin login failed. Cannot continue.")
        return
    
    # Check ai_gear_validation_enabled setting
    settings = get_platform_settings(admin_token)
    ai_enabled = settings.get("ai_gear_validation_enabled", False)
    
    if not ai_enabled:
        print("\nℹ️  AI Gear Validation is disabled. Enabling it...")
        if not update_platform_settings(admin_token, True):
            print("\n❌ CRITICAL: Failed to enable AI Gear Validation. Cannot continue.")
            return
        settings = get_platform_settings(admin_token)
        ai_enabled = settings.get("ai_gear_validation_enabled", False)
        if not ai_enabled:
            print("\n❌ CRITICAL: AI Gear Validation still disabled after update. Cannot continue.")
            return
    
    # Login as regular user
    user_token = login(USER_EMAIL, USER_PASSWORD)
    if not user_token:
        print("\n❌ CRITICAL: User login failed. Cannot continue.")
        return
    
    # Submit a clearly valid gear item (should auto-approve with real AI)
    print("\nℹ️  Submitting valid gear item (Sony Alpha 7 IV)...")
    valid_submission = submit_custom_gear(user_token, "Sony Alpha 7 IV Full-Frame Mirrorless Camera", "Camera", "Sony")
    if valid_submission:
        status = valid_submission.get("status")
        if status == "auto_approved":
            print(f"   ℹ️  Item auto-approved (expected with real AI). Confidence: {valid_submission.get('ai_confidence')}")
        elif status == "auto_exists":
            print(f"   ℹ️  Item already exists in catalogue (expected).")
        else:
            print(f"   ℹ️  Item status: {status}")
    
    # Submit a nonsense/ambiguous item to force "pending" status
    print("\nℹ️  Submitting nonsense gear item (XYZ Widget Thingamajig 9000)...")
    pending_submission = submit_custom_gear(user_token, "XYZ Widget Thingamajig 9000", "Accessories", None)
    if not pending_submission:
        print("\n❌ CRITICAL: Failed to submit nonsense gear. Cannot continue.")
        return
    
    pending_id = pending_submission.get("id")
    pending_status = pending_submission.get("status")
    
    if pending_status != "pending":
        print(f"\n⚠️  WARNING: Expected 'pending' status but got '{pending_status}'. This may affect tests.")
        # Try another nonsense item
        print("\nℹ️  Trying another nonsense item (Random Gadget 12345)...")
        pending_submission = submit_custom_gear(user_token, "Random Gadget 12345 Non-Photography Item", "Other", None)
        if pending_submission:
            pending_id = pending_submission.get("id")
            pending_status = pending_submission.get("status")
            if pending_status != "pending":
                print(f"\n⚠️  WARNING: Still got '{pending_status}' status. Continuing anyway...")
    
    test_submission_ids.append(pending_id)
    
    # ========== TEST 1: Manual "Validate by AI" button ==========
    print("\n" + "=" * 80)
    print("TEST 1: Manual 'Validate by AI' button endpoint")
    print("=" * 80)
    
    # 1.1 - List pending submissions
    pending_items = get_pending_submissions(admin_token)
    if not pending_items:
        print("\n⚠️  WARNING: No pending submissions found. Creating one...")
        test_sub = submit_custom_gear(user_token, "Test Nonsense Item ABC123", "Other", None)
        if test_sub:
            pending_id = test_sub.get("id")
            test_submission_ids.append(pending_id)
            pending_items = get_pending_submissions(admin_token)
    
    # Find our pending submission
    our_pending = next((item for item in pending_items if item.get("id") == pending_id), None)
    if not our_pending:
        print(f"\n⚠️  WARNING: Could not find pending submission {pending_id} in list. Using first available...")
        if pending_items:
            our_pending = pending_items[0]
            pending_id = our_pending.get("id")
    
    # 1.2 - Call validate-ai endpoint as admin
    print(f"\nℹ️  TEST 1.2: Calling validate-ai on submission {pending_id}...")
    result = validate_submission_with_ai(admin_token, pending_id, expect_status=200)
    if result:
        decision = result.get("decision")
        if decision in ["approved", "rejected"]:
            print(f"   ✅ Submission resolved with decision: {decision}")
        else:
            print(f"   ⚠️  Unexpected decision: {decision}")
    
    # 1.3 - Verify submission is no longer in pending list
    print(f"\nℹ️  TEST 1.3: Verifying submission {pending_id} is no longer pending...")
    pending_items_after = get_pending_submissions(admin_token)
    still_pending = any(item.get("id") == pending_id for item in pending_items_after)
    if not still_pending:
        log_test("Submission removed from pending list", "PASS", 
                f"Submission {pending_id} is no longer in pending list")
    else:
        log_test("Submission removed from pending list", "FAIL", 
                f"Submission {pending_id} is still in pending list")
    
    # 1.4 - Try calling validate-ai again (should fail with 400)
    print(f"\nℹ️  TEST 1.4: Calling validate-ai on already-resolved submission {pending_id}...")
    result = validate_submission_with_ai(admin_token, pending_id, expect_status=400)
    if result and result.get("status_code") == 400:
        print(f"   ✅ Correctly rejected with 400: {result.get('detail')}")
    
    # 1.5 - Try calling validate-ai on non-existent submission (should fail with 404)
    print(f"\nℹ️  TEST 1.5: Calling validate-ai on non-existent submission...")
    fake_id = "nonexistent-submission-id-12345"
    result = validate_submission_with_ai(admin_token, fake_id, expect_status=404)
    if result and result.get("status_code") == 404:
        print(f"   ✅ Correctly rejected with 404: {result.get('detail')}")
    
    # 1.6 - Try calling validate-ai as non-admin user (should fail with 401/403)
    print(f"\nℹ️  TEST 1.6: Calling validate-ai as non-admin user...")
    # First create a new pending submission
    test_sub2 = submit_custom_gear(user_token, "Another Test Item XYZ789", "Other", None)
    if test_sub2:
        test_id2 = test_sub2.get("id")
        test_submission_ids.append(test_id2)
        result = validate_submission_with_ai(user_token, test_id2, expect_status=403)
        if result and result.get("status_code") == 403:
            print(f"   ✅ Correctly rejected with 403: {result.get('detail')}")
    
    # ========== TEST 2: Manual "Run AI Sweep Now" ==========
    print("\n" + "=" * 80)
    print("TEST 2: Manual 'Run AI Sweep Now' endpoint")
    print("=" * 80)
    
    # 2.1 - Create 2 more pending submissions
    print("\nℹ️  TEST 2.1: Creating 2 more pending submissions...")
    sub1 = submit_custom_gear(user_token, "Nonsense Item Alpha 111", "Other", None)
    sub2 = submit_custom_gear(user_token, "Nonsense Item Beta 222", "Other", None)
    if sub1:
        test_submission_ids.append(sub1.get("id"))
    if sub2:
        test_submission_ids.append(sub2.get("id"))
    
    # 2.2 - Call run-sweep as admin
    print("\nℹ️  TEST 2.2: Calling run-sweep as admin...")
    pending_before = get_pending_submissions(admin_token)
    print(f"   ℹ️  Pending submissions before sweep: {len(pending_before)}")
    
    sweep_result = run_sweep(admin_token, expect_status=200)
    if sweep_result:
        total = sweep_result.get("total", 0)
        approved = sweep_result.get("approved", 0)
        rejected = sweep_result.get("rejected", 0)
        if total > 0 and (approved + rejected) == total:
            print(f"   ✅ Sweep processed {total} submissions correctly")
        else:
            print(f"   ⚠️  Sweep result: total={total}, approved={approved}, rejected={rejected}")
    
    # 2.3 - Verify all pending submissions are resolved
    print("\nℹ️  TEST 2.3: Verifying all pending submissions are resolved...")
    pending_after = get_pending_submissions(admin_token)
    if len(pending_after) == 0:
        log_test("All pending submissions resolved", "PASS", 
                "No pending submissions remaining after sweep")
    else:
        log_test("All pending submissions resolved", "FAIL", 
                f"{len(pending_after)} pending submissions still remain")
    
    # 2.4 - Try calling run-sweep as non-admin user (should fail with 401/403)
    print("\nℹ️  TEST 2.4: Calling run-sweep as non-admin user...")
    try:
        response = requests.post(
            f"{BASE_URL}/platform/gear-submissions/run-sweep",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        if response.status_code in [401, 403]:
            log_test("Non-admin run-sweep blocked", "PASS", 
                    f"Correctly rejected with {response.status_code}")
        else:
            log_test("Non-admin run-sweep blocked", "FAIL", 
                    f"Expected 401/403, got {response.status_code}")
    except Exception as e:
        log_test("Non-admin run-sweep blocked", "FAIL", f"Exception: {str(e)}")
    
    # ========== TEST 3: AI disabled behavior ==========
    print("\n" + "=" * 80)
    print("TEST 3: AI disabled behavior")
    print("=" * 80)
    
    # 3.1 - Disable AI
    print("\nℹ️  TEST 3.1: Disabling AI Gear Validation...")
    if not update_platform_settings(admin_token, False):
        print("\n⚠️  WARNING: Failed to disable AI. Skipping TEST 3.")
    else:
        # 3.2 - Create a new pending submission (should land as pending with AI disabled)
        print("\nℹ️  TEST 3.2: Creating submission with AI disabled...")
        disabled_sub = submit_custom_gear(user_token, "Test Item With AI Disabled 999", "Other", None)
        if disabled_sub:
            disabled_id = disabled_sub.get("id")
            disabled_status = disabled_sub.get("status")
            test_submission_ids.append(disabled_id)
            if disabled_status == "pending":
                print(f"   ✅ Submission landed as 'pending' (expected with AI disabled)")
            else:
                print(f"   ℹ️  Submission status: {disabled_status}")
            
            # 3.3 - Try calling validate-ai (should fail with 400)
            print(f"\nℹ️  TEST 3.3: Calling validate-ai with AI disabled...")
            result = validate_submission_with_ai(admin_token, disabled_id, expect_status=400)
            if result and result.get("status_code") == 400:
                detail = result.get("detail", "")
                if "disabled" in detail.lower():
                    print(f"   ✅ Correctly rejected with 400: {detail}")
                else:
                    print(f"   ⚠️  Got 400 but unexpected message: {detail}")
        
        # 3.4 - Try calling run-sweep (should return skipped=true)
        print("\nℹ️  TEST 3.4: Calling run-sweep with AI disabled...")
        sweep_result = run_sweep(admin_token, expect_status=200)
        if sweep_result:
            skipped = sweep_result.get("skipped", False)
            reason = sweep_result.get("reason", "")
            if skipped and "ai_disabled" in reason:
                print(f"   ✅ Sweep correctly skipped: {reason}")
            else:
                print(f"   ⚠️  Unexpected result: skipped={skipped}, reason={reason}")
        
        # 3.5 - Re-enable AI and cleanup
        print("\nℹ️  TEST 3.5: Re-enabling AI Gear Validation...")
        if update_platform_settings(admin_token, True):
            print("   ✅ AI Gear Validation re-enabled")
            
            # Run sweep to clean up any leftover pending submissions
            print("\nℹ️  Running final cleanup sweep...")
            sweep_result = run_sweep(admin_token, expect_status=200)
            if sweep_result:
                print(f"   ℹ️  Cleanup sweep: {sweep_result}")
            
            # Verify no pending submissions remain
            final_pending = get_pending_submissions(admin_token)
            if len(final_pending) == 0:
                print("   ✅ All pending submissions cleaned up")
            else:
                print(f"   ⚠️  {len(final_pending)} pending submissions still remain")
    
    # ========== TEST 4: Scheduler registration ==========
    print("\n" + "=" * 80)
    print("TEST 4: Scheduler registration (informational)")
    print("=" * 80)
    
    print("\nℹ️  Checking backend logs for scheduler confirmation...")
    try:
        import subprocess
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True
        )
        logs = result.stdout
        
        scheduler_started = "Scheduler started — gear AI validation sweep set for 03:00 and 17:00 IST daily" in logs
        job_added_count = logs.count('Added job "run_gear_validation_sweep" to job store')
        
        if scheduler_started:
            log_test("Scheduler started message found", "PASS", 
                    "Found: 'Scheduler started — gear AI validation sweep set for 03:00 and 17:00 IST daily'")
        else:
            log_test("Scheduler started message found", "FAIL", 
                    "Message not found in recent logs")
        
        if job_added_count >= 2:
            log_test("Scheduler jobs registered", "PASS", 
                    f"Found {job_added_count} 'Added job' messages (expected 2 per startup: 3AM & 5PM)")
        else:
            log_test("Scheduler jobs registered", "FAIL", 
                    f"Found only {job_added_count} 'Added job' messages (expected 2)")
        
    except Exception as e:
        log_test("Scheduler log check", "FAIL", f"Exception: {str(e)}")
    
    # ========== SUMMARY ==========
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("\n✅ All tests completed. Review results above for any failures.")
    print(f"\nℹ️  Test submission IDs created: {len(test_submission_ids)}")
    print(f"   {test_submission_ids}")
    print("\nℹ️  All test submissions should have been resolved by the sweep.")
    print("   Gear catalogue and submissions collection should be in a clean state.")


if __name__ == "__main__":
    main()
