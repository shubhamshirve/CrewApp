#!/usr/bin/env python3
"""
Backend API Testing Script for Photoo - New Features
Tests 4 new features:
1. Username feature (check-username, set-username, lookup)
2. Razorpay DB read fix (admin API keys management)
3. WhatsApp button (profile data check)
4. Gemini key update (gear normalize)
"""

import requests
import json
import sys

# Backend URL
BASE_URL = "http://localhost:8001/api"

# Test credentials
ADMIN_EMAIL = "admin@photoo.in"
ADMIN_PASSWORD = "Admin@123"
ROHAN_EMAIL = "rohan@example.com"
ROHAN_PASSWORD = "Test@1234"
VIKRAM_EMAIL = "vikram@example.com"
VIKRAM_PASSWORD = "Test@1234"

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_test(name):
    print(f"\n{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}TEST: {name}{RESET}")
    print(f"{CYAN}{'='*70}{RESET}")


def print_pass(msg):
    print(f"{GREEN}✓ PASS:{RESET} {msg}")


def print_fail(msg):
    print(f"{RED}✗ FAIL:{RESET} {msg}")


def print_info(msg):
    print(f"{YELLOW}→{RESET} {msg}")


def login(email, password):
    """Login and return JWT token"""
    print_info(f"Logging in as {email}...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("token") or data.get("access_token")
        if token:
            print_pass(f"Login successful. Token: {token[:20]}...")
            return token
        else:
            print_fail(f"Login response missing token: {data}")
            return None
    else:
        print_fail(f"Login failed: {response.status_code} - {response.text}")
        return None


# ============================================================================
# TEST 1: USERNAME FEATURE
# ============================================================================

def test_check_username_taken():
    """
    TEST 1.1: Check if username 'rohanphotoo' is taken (should be)
    Expected: {available: false}
    """
    print_test("Check Username - Already Taken (rohanphotoo)")
    
    response = requests.get(f"{BASE_URL}/users/check-username/rohanphotoo")
    
    print_info(f"GET /users/check-username/rohanphotoo")
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text}")
    
    if response.status_code != 200:
        print_fail(f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
        if data.get("available") == False:
            print_pass("Username 'rohanphotoo' is correctly marked as unavailable")
            return True
        else:
            print_fail(f"Expected available=false, got {data}")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


def test_check_username_available():
    """
    TEST 1.2: Check if username 'newusername123' is available (should be)
    Expected: {available: true}
    """
    print_test("Check Username - Available (newusername123)")
    
    response = requests.get(f"{BASE_URL}/users/check-username/newusername123")
    
    print_info(f"GET /users/check-username/newusername123")
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text}")
    
    if response.status_code != 200:
        print_fail(f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
        if data.get("available") == True:
            print_pass("Username 'newusername123' is correctly marked as available")
            return True
        else:
            print_fail(f"Expected available=true, got {data}")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


def test_check_username_invalid_format():
    """
    TEST 1.3: Check if username '123bad' is invalid (starts with number)
    Expected: {available: false, reason: "Invalid format"}
    """
    print_test("Check Username - Invalid Format (123bad)")
    
    response = requests.get(f"{BASE_URL}/users/check-username/123bad")
    
    print_info(f"GET /users/check-username/123bad")
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text}")
    
    if response.status_code != 200:
        print_fail(f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
        if data.get("available") == False and "reason" in data:
            print_pass(f"Username '123bad' is correctly marked as invalid: {data.get('reason')}")
            return True
        else:
            print_fail(f"Expected available=false with reason, got {data}")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


def test_set_username_already_set(token):
    """
    TEST 1.4: Try to set username when already set (rohan has 'rohanphotoo')
    Expected: 409 "Username already set and cannot be changed"
    """
    print_test("Set Username - Already Set (rohan)")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"username": "rohannew"}
    
    print_info(f"POST /users/set-username")
    print_info(f"Payload: {json.dumps(payload)}")
    
    response = requests.post(
        f"{BASE_URL}/users/set-username",
        headers=headers,
        json=payload
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text}")
    
    if response.status_code == 409:
        try:
            data = response.json()
            detail = data.get("detail", "")
            if "already set" in detail.lower() or "cannot be changed" in detail.lower():
                print_pass(f"Correctly rejected: {detail}")
                return True
            else:
                print_fail(f"Got 409 but wrong message: {detail}")
                return False
        except:
            print_fail("Response is not valid JSON")
            return False
    else:
        print_fail(f"Expected 409, got {response.status_code}")
        return False


def test_lookup_by_username(token):
    """
    TEST 1.5: Lookup user by username (GET /users/rohanphotoo)
    Expected: Returns rohan's profile with username=rohanphotoo
    """
    print_test("Lookup User by Username (rohanphotoo)")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET /users/rohanphotoo")
    
    response = requests.get(
        f"{BASE_URL}/users/rohanphotoo",
        headers=headers
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text[:500]}")
    
    if response.status_code != 200:
        print_fail(f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
        if data.get("username") == "rohanphotoo":
            print_pass(f"Successfully looked up user by username: {data.get('full_name')} (@{data.get('username')})")
            return True
        else:
            print_fail(f"Expected username='rohanphotoo', got {data.get('username')}")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


# ============================================================================
# TEST 2: RAZORPAY DB READ FIX
# ============================================================================

def test_razorpay_admin_update_key_id(admin_token):
    """
    TEST 2.1: Admin updates Razorpay key_id via API
    Expected: 200 with status=ok
    """
    print_test("Razorpay DB Read - Admin Update Key ID")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "group": "razorpay",
        "field": "key_id",
        "value": "rzp_live_realkey123"
    }
    
    print_info(f"PUT /platform/api-keys")
    print_info(f"Payload: {json.dumps(payload)}")
    
    response = requests.put(
        f"{BASE_URL}/platform/api-keys",
        headers=headers,
        json=payload
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text}")
    
    if response.status_code != 200:
        print_fail(f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
        if data.get("status") == "ok" and data.get("group") == "razorpay":
            print_pass("Successfully updated Razorpay key_id")
            return True
        else:
            print_fail(f"Unexpected response: {data}")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


def test_razorpay_admin_update_key_secret(admin_token):
    """
    TEST 2.2: Admin updates Razorpay key_secret via API
    Expected: 200 with status=ok
    """
    print_test("Razorpay DB Read - Admin Update Key Secret")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "group": "razorpay",
        "field": "key_secret",
        "value": "realsecret456"
    }
    
    print_info(f"PUT /platform/api-keys")
    print_info(f"Payload: {json.dumps(payload)}")
    
    response = requests.put(
        f"{BASE_URL}/platform/api-keys",
        headers=headers,
        json=payload
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text}")
    
    if response.status_code != 200:
        print_fail(f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
        if data.get("status") == "ok" and data.get("group") == "razorpay":
            print_pass("Successfully updated Razorpay key_secret")
            return True
        else:
            print_fail(f"Unexpected response: {data}")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


def test_razorpay_create_order_with_test_keys(token):
    """
    TEST 2.3: Try to create order with test keys (should fail with 503 or payment error)
    Expected: Either 503 with "Payment gateway error" OR success (if keys work)
    Should NOT be 500 Internal Server Error
    """
    print_test("Razorpay DB Read - Create Order with Test Keys")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "plan_id": "plan-basic-000000-0000-0000-0000-000000000001"
    }
    
    print_info(f"POST /wallet/subscribe/create-order")
    print_info(f"Payload: {json.dumps(payload)}")
    print_info(f"Note: Using vikram (₹0 wallet) to force Razorpay call")
    
    response = requests.post(
        f"{BASE_URL}/wallet/subscribe/create-order",
        headers=headers,
        json=payload
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text[:500]}")
    
    # Accept either 503 (payment gateway error) or 200 (success with real keys)
    if response.status_code == 503:
        try:
            data = response.json()
            detail = data.get("detail", "")
            if "payment gateway error" in detail.lower():
                print_pass(f"Got expected 503 with payment gateway error: {detail}")
                return True
            else:
                print_fail(f"Got 503 but wrong message: {detail}")
                return False
        except:
            print_fail("Response is not valid JSON")
            return False
    elif response.status_code == 200:
        print_pass("Got 200 - Razorpay keys are working (order created successfully)")
        return True
    elif response.status_code == 500:
        print_fail("Got 500 Internal Server Error - BUG: Should be 503 with clear message")
        return False
    else:
        print_fail(f"Unexpected status code: {response.status_code}")
        return False


# ============================================================================
# TEST 3: WHATSAPP BUTTON (PROFILE DATA)
# ============================================================================

def test_whatsapp_profile_data(token):
    """
    TEST 3.1: Check if profile returns whatsapp_number field
    Expected: GET /users/rohanphotoo returns whatsapp_number or phone field
    """
    print_test("WhatsApp Button - Profile Data Check")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET /users/rohanphotoo")
    
    response = requests.get(
        f"{BASE_URL}/users/rohanphotoo",
        headers=headers
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text[:500]}")
    
    if response.status_code != 200:
        print_fail(f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
        whatsapp = data.get("whatsapp_number")
        phone = data.get("phone")
        
        if whatsapp or phone:
            print_pass(f"Profile contains phone/whatsapp data: whatsapp_number={whatsapp}, phone={phone}")
            return True
        else:
            print_fail(f"Profile missing whatsapp_number and phone fields")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


# ============================================================================
# TEST 4: GEMINI KEY UPDATE
# ============================================================================

def test_gemini_key_in_env():
    """
    TEST 4.1: Check if Gemini key in .env is the new one
    Expected: AIzaSyB4sv4m14QvG3R-ust4mhW21FYZxU168_w
    """
    print_test("Gemini Key - Check .env File")
    
    try:
        with open("/app/backend/.env", "r") as f:
            content = f.read()
        
        print_info(f".env content:\n{content}")
        
        expected_key = "AIzaSyB4sv4m14QvG3R-ust4mhW21FYZxU168_w"
        
        if expected_key in content:
            print_pass(f"Gemini key is correct: {expected_key}")
            return True
        else:
            print_fail(f"Gemini key not found or incorrect in .env")
            return False
    except Exception as e:
        print_fail(f"Failed to read .env file: {e}")
        return False


def test_gemini_gear_normalize(token):
    """
    TEST 4.2: Test gear normalize with Gemini key
    Expected: GET /platform/gear-catalogue/normalize?name=canon+r5 returns normalized result
    """
    print_test("Gemini Key - Gear Normalize API")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET /platform/gear-catalogue/normalize?name=canon+r5")
    
    response = requests.get(
        f"{BASE_URL}/platform/gear-catalogue/normalize?name=canon+r5",
        headers=headers
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text[:500]}")
    
    if response.status_code != 200:
        print_fail(f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
        normalized_name = data.get("normalized_name", "")
        confidence = data.get("confidence", 0)
        
        if normalized_name and confidence > 0:
            print_pass(f"Gear normalize working: '{normalized_name}' (confidence: {confidence})")
            return True
        else:
            print_fail(f"Gear normalize returned low confidence or empty result: {data}")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


# ============================================================================
# MAIN
# ============================================================================

def main():
    print(f"\n{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}Photoo Backend Testing - New Features{RESET}")
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"\n{YELLOW}Testing 4 Features:{RESET}")
    print(f"  1. Username feature (check-username, set-username, lookup)")
    print(f"  2. Razorpay DB read fix (admin API keys management)")
    print(f"  3. WhatsApp button (profile data check)")
    print(f"  4. Gemini key update (gear normalize)")
    
    # Login as admin
    print(f"\n{BOLD}Logging in as Admin...{RESET}")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print(f"\n{RED}ABORT: Admin login failed{RESET}")
        sys.exit(1)
    
    # Login as rohan
    print(f"\n{BOLD}Logging in as Rohan...{RESET}")
    rohan_token = login(ROHAN_EMAIL, ROHAN_PASSWORD)
    if not rohan_token:
        print(f"\n{RED}ABORT: Rohan login failed{RESET}")
        sys.exit(1)
    
    # Login as vikram
    print(f"\n{BOLD}Logging in as Vikram...{RESET}")
    vikram_token = login(VIKRAM_EMAIL, VIKRAM_PASSWORD)
    if not vikram_token:
        print(f"\n{RED}ABORT: Vikram login failed{RESET}")
        sys.exit(1)
    
    # Run tests
    results = []
    
    # TEST 1: USERNAME FEATURE
    print(f"\n{BOLD}{YELLOW}{'='*70}{RESET}")
    print(f"{BOLD}{YELLOW}TEST SUITE 1: USERNAME FEATURE{RESET}")
    print(f"{BOLD}{YELLOW}{'='*70}{RESET}")
    
    results.append(("1.1 Check username taken (rohanphotoo)", test_check_username_taken()))
    results.append(("1.2 Check username available (newusername123)", test_check_username_available()))
    results.append(("1.3 Check username invalid format (123bad)", test_check_username_invalid_format()))
    results.append(("1.4 Set username already set (rohan)", test_set_username_already_set(rohan_token)))
    results.append(("1.5 Lookup by username (rohanphotoo)", test_lookup_by_username(rohan_token)))
    
    # TEST 2: RAZORPAY DB READ FIX
    print(f"\n{BOLD}{YELLOW}{'='*70}{RESET}")
    print(f"{BOLD}{YELLOW}TEST SUITE 2: RAZORPAY DB READ FIX{RESET}")
    print(f"{BOLD}{YELLOW}{'='*70}{RESET}")
    
    results.append(("2.1 Admin update Razorpay key_id", test_razorpay_admin_update_key_id(admin_token)))
    results.append(("2.2 Admin update Razorpay key_secret", test_razorpay_admin_update_key_secret(admin_token)))
    results.append(("2.3 Create order with test keys", test_razorpay_create_order_with_test_keys(vikram_token)))
    
    # TEST 3: WHATSAPP BUTTON
    print(f"\n{BOLD}{YELLOW}{'='*70}{RESET}")
    print(f"{BOLD}{YELLOW}TEST SUITE 3: WHATSAPP BUTTON (PROFILE DATA){RESET}")
    print(f"{BOLD}{YELLOW}{'='*70}{RESET}")
    
    results.append(("3.1 WhatsApp profile data check", test_whatsapp_profile_data(rohan_token)))
    
    # TEST 4: GEMINI KEY UPDATE
    print(f"\n{BOLD}{YELLOW}{'='*70}{RESET}")
    print(f"{BOLD}{YELLOW}TEST SUITE 4: GEMINI KEY UPDATE{RESET}")
    print(f"{BOLD}{YELLOW}{'='*70}{RESET}")
    
    results.append(("4.1 Gemini key in .env", test_gemini_key_in_env()))
    results.append(("4.2 Gear normalize API", test_gemini_gear_normalize(rohan_token)))
    
    # Summary
    print(f"\n{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}TEST SUMMARY{RESET}")
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = f"{GREEN}✓ PASS{RESET}" if result else f"{RED}✗ FAIL{RESET}"
        print(f"  {status} - {name}")
    
    print(f"\n{BOLD}Results: {passed}/{total} tests passed{RESET}")
    
    if passed == total:
        print(f"{GREEN}{BOLD}✓ ALL TESTS PASSED{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}{BOLD}✗ SOME TESTS FAILED{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
