#!/usr/bin/env python3
"""
Backend API Testing Script for Photoo
Tests the Razorpay missing credentials crash fix
"""

import requests
import json
import sys

# Backend URL (internal)
BASE_URL = "http://localhost:8001/api"

# Test credentials
VIKRAM_EMAIL = "vikram@example.com"
VIKRAM_PASSWORD = "Test@1234"

# Test data
PLAN_ID = "plan-basic-000000-0000-0000-0000-000000000001"  # Basic plan ₹69
COUPON_CODE = "TEST20"  # 20% off

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


def test_subscribe_with_coupon_no_razorpay(token):
    """
    TEST 1: Subscribe with coupon when Razorpay credentials are missing
    Expected: HTTP 503 with message about payment gateway not configured
    Should NOT return HTTP 500 Internal Server Error
    """
    print_test("Subscribe with Coupon (No Razorpay Credentials)")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "plan_id": PLAN_ID,
        "coupon_code": COUPON_CODE
    }
    
    print_info(f"POST /wallet/subscribe/create-order")
    print_info(f"Payload: {json.dumps(payload, indent=2)}")
    print_info(f"Expected: User has ₹0 wallet, coupon gives 20% off (₹69 → ₹55.20)")
    print_info(f"Expected: Since remaining ₹55.20 > 0 and Razorpay not configured → HTTP 503")
    
    response = requests.post(
        f"{BASE_URL}/wallet/subscribe/create-order",
        headers=headers,
        json=payload
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text[:500]}")
    
    # Check status code
    if response.status_code == 503:
        print_pass("Returned HTTP 503 (Service Unavailable) as expected")
    elif response.status_code == 500:
        print_fail("Returned HTTP 500 (Internal Server Error) - BUG NOT FIXED!")
        return False
    else:
        print_fail(f"Unexpected status code: {response.status_code}")
        return False
    
    # Check response message
    try:
        data = response.json()
        detail = data.get("detail", "")
        
        if "payment gateway" in detail.lower() or "not configured" in detail.lower():
            print_pass(f"Response message is correct: '{detail}'")
            return True
        else:
            print_fail(f"Response message unexpected: '{detail}'")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


def test_subscribe_without_coupon_no_razorpay(token):
    """
    TEST 2: Subscribe without coupon when Razorpay credentials are missing
    Expected: HTTP 503 with message about payment gateway not configured
    Should NOT return HTTP 500 Internal Server Error
    """
    print_test("Subscribe WITHOUT Coupon (No Razorpay Credentials)")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "plan_id": PLAN_ID
    }
    
    print_info(f"POST /wallet/subscribe/create-order")
    print_info(f"Payload: {json.dumps(payload, indent=2)}")
    print_info(f"Expected: User has ₹0 wallet, no coupon (₹69 full price)")
    print_info(f"Expected: Since remaining ₹69 > 0 and Razorpay not configured → HTTP 503")
    
    response = requests.post(
        f"{BASE_URL}/wallet/subscribe/create-order",
        headers=headers,
        json=payload
    )
    
    print_info(f"Response Status: {response.status_code}")
    print_info(f"Response Body: {response.text[:500]}")
    
    # Check status code
    if response.status_code == 503:
        print_pass("Returned HTTP 503 (Service Unavailable) as expected")
    elif response.status_code == 500:
        print_fail("Returned HTTP 500 (Internal Server Error) - BUG NOT FIXED!")
        return False
    else:
        print_fail(f"Unexpected status code: {response.status_code}")
        return False
    
    # Check response message
    try:
        data = response.json()
        detail = data.get("detail", "")
        
        if "payment gateway" in detail.lower() or "not configured" in detail.lower():
            print_pass(f"Response message is correct: '{detail}'")
            return True
        else:
            print_fail(f"Response message unexpected: '{detail}'")
            return False
    except:
        print_fail("Response is not valid JSON")
        return False


def verify_vikram_wallet_balance(token):
    """Verify that Vikram has 0 wallet balance"""
    print_test("Verify Vikram's Wallet Balance")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/wallet", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        balance = data.get("balance", -1)
        print_info(f"Wallet balance: ₹{balance}")
        
        if balance == 0.0:
            print_pass("Vikram has ₹0 wallet balance (correct for test)")
            return True
        else:
            print_fail(f"Vikram has ₹{balance} wallet balance (expected ₹0)")
            return False
    else:
        print_fail(f"Failed to get wallet: {response.status_code}")
        return False


def main():
    print(f"\n{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}Photoo Backend Testing - Razorpay Crash Fix{RESET}")
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"\n{YELLOW}Testing Scenario:{RESET}")
    print(f"  User: {VIKRAM_EMAIL} (₹0 wallet balance)")
    print(f"  Plan: Basic (₹69/month)")
    print(f"  Coupon: {COUPON_CODE} (20% off)")
    print(f"  Razorpay: NOT CONFIGURED (expected)")
    print(f"\n{YELLOW}Expected Behavior:{RESET}")
    print(f"  - Should return HTTP 503 (not 500)")
    print(f"  - Should show clear message about payment gateway not configured")
    
    # Login
    token = login(VIKRAM_EMAIL, VIKRAM_PASSWORD)
    if not token:
        print(f"\n{RED}ABORT: Login failed{RESET}")
        sys.exit(1)
    
    # Verify wallet balance
    if not verify_vikram_wallet_balance(token):
        print(f"\n{YELLOW}WARNING: Wallet balance is not ₹0, but continuing tests...{RESET}")
    
    # Run tests
    results = []
    
    # Test 1: Subscribe with coupon
    results.append(("Subscribe with Coupon", test_subscribe_with_coupon_no_razorpay(token)))
    
    # Test 2: Subscribe without coupon
    results.append(("Subscribe without Coupon", test_subscribe_without_coupon_no_razorpay(token)))
    
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
        print(f"{GREEN}{BOLD}✓ ALL TESTS PASSED - BUG FIX VERIFIED{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}{BOLD}✗ SOME TESTS FAILED - BUG NOT FULLY FIXED{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
