#!/usr/bin/env python3
"""
Backend API Testing Script for Photoo/CrewBook
Tests admin change-password and admin reset-password features
"""

import requests
import json
import sys
from typing import Dict, Optional

# Backend URL
BASE_URL = "http://localhost:8001/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@photoo.in"
ADMIN_PASSWORD = "Admin@123"
USER_EMAIL = "rohan@example.com"
USER_PASSWORD = "Test@1234"

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed += 1
        self.tests.append({"name": test_name, "status": "PASS", "details": details})
        print(f"{GREEN}✓ PASS{RESET}: {test_name}")
        if details:
            print(f"  {details}")
    
    def add_fail(self, test_name: str, details: str = ""):
        self.failed += 1
        self.tests.append({"name": test_name, "status": "FAIL", "details": details})
        print(f"{RED}✗ FAIL{RESET}: {test_name}")
        if details:
            print(f"  {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY: {self.passed}/{total} passed")
        print(f"{'='*80}")
        return self.failed == 0


def login(email: str, password: str) -> Optional[Dict]:
    """Login and return token + user data"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data.get("token"),
                "user": data.get("user"),
                "email": email
            }
        return None
    except Exception as e:
        print(f"{RED}Login error: {e}{RESET}")
        return None


def get_me(token: str) -> Optional[Dict]:
    """Get current user info"""
    try:
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"{RED}Get me error: {e}{RESET}")
        return None


def change_password(token: str, current_password: str, new_password: str) -> tuple:
    """Change password for authenticated user"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/change-password",
            json={
                "current_password": current_password,
                "new_password": new_password
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        return response.status_code, response.json() if response.status_code == 200 else response.text
    except Exception as e:
        return 0, str(e)


def admin_reset_user_password(admin_token: str, user_id: str) -> tuple:
    """Admin resets a user's password"""
    try:
        response = requests.post(
            f"{BASE_URL}/admin/users/{user_id}/reset-password",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        return response.status_code, response.json() if response.status_code in [200, 400, 403] else response.text
    except Exception as e:
        return 0, str(e)


def get_admin_users(admin_token: str, search: str = "") -> Optional[Dict]:
    """Get users list from admin endpoint"""
    try:
        url = f"{BASE_URL}/admin/users"
        if search:
            url += f"?search={search}"
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"{RED}Get admin users error: {e}{RESET}")
        return None


def test_feature_1_admin_change_password(result: TestResult):
    """
    FEATURE 1 — Admin change password (reuses generic /auth/change-password endpoint)
    """
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}FEATURE 1: Admin Change Password{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    # Step 1: Login as admin
    print(f"{YELLOW}Step 1: Login as admin{RESET}")
    admin_auth = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_auth:
        result.add_fail("F1.1 - Admin login with original password", "Failed to login as admin")
        return
    result.add_pass("F1.1 - Admin login with original password", f"Token: {admin_auth['token'][:20]}...")
    admin_token = admin_auth["token"]
    
    # Step 2: Change admin password to new password
    print(f"\n{YELLOW}Step 2: Change admin password to AdminNew@123{RESET}")
    status, response = change_password(admin_token, ADMIN_PASSWORD, "AdminNew@123")
    if status == 200 and "Password changed successfully" in str(response):
        result.add_pass("F1.2 - Change password to AdminNew@123", f"Response: {response}")
    else:
        result.add_fail("F1.2 - Change password to AdminNew@123", f"Status: {status}, Response: {response}")
        return
    
    # Step 3: Verify old password no longer works
    print(f"\n{YELLOW}Step 3: Verify old password (Admin@123) no longer works{RESET}")
    old_login = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if old_login is None:
        result.add_pass("F1.3 - Old password rejected", "Login with Admin@123 correctly failed")
    else:
        result.add_fail("F1.3 - Old password rejected", "Old password still works - should have been rejected")
    
    # Step 4: Verify new password works
    print(f"\n{YELLOW}Step 4: Verify new password (AdminNew@123) works{RESET}")
    new_login = login(ADMIN_EMAIL, "AdminNew@123")
    if new_login and new_login.get("token"):
        result.add_pass("F1.4 - New password works", f"Login successful with AdminNew@123")
        new_admin_token = new_login["token"]
    else:
        result.add_fail("F1.4 - New password works", "Failed to login with new password")
        return
    
    # Step 5: IMPORTANT - Change password back to Admin@123
    print(f"\n{YELLOW}Step 5: CLEANUP - Change password back to Admin@123{RESET}")
    status, response = change_password(new_admin_token, "AdminNew@123", ADMIN_PASSWORD)
    if status == 200 and "Password changed successfully" in str(response):
        result.add_pass("F1.5 - Restore password to Admin@123", f"Response: {response}")
    else:
        result.add_fail("F1.5 - Restore password to Admin@123", f"Status: {status}, Response: {response}")
        return
    
    # Step 6: Verify restored password works
    print(f"\n{YELLOW}Step 6: Verify restored password (Admin@123) works{RESET}")
    restored_login = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if restored_login and restored_login.get("token"):
        result.add_pass("F1.6 - Restored password works", "Login successful with Admin@123")
    else:
        result.add_fail("F1.6 - Restored password works", "Failed to login with restored password")


def test_feature_2_admin_reset_user_password(result: TestResult):
    """
    FEATURE 2 — Admin reset user password (new endpoint) + forced password change flow
    """
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}FEATURE 2: Admin Reset User Password + Forced Change Flow{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    # Step 1: Login as admin
    print(f"{YELLOW}Step 1: Login as admin{RESET}")
    admin_auth = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_auth:
        result.add_fail("F2.1 - Admin login", "Failed to login as admin")
        return
    result.add_pass("F2.1 - Admin login", f"Token: {admin_auth['token'][:20]}...")
    admin_token = admin_auth["token"]
    admin_user_id = admin_auth["user"]["id"]
    
    # Step 2: Find rohan user
    print(f"\n{YELLOW}Step 2: Find rohan user via admin API{RESET}")
    users_data = get_admin_users(admin_token, "rohan")
    if not users_data or not users_data.get("users"):
        result.add_fail("F2.2 - Find rohan user", "Failed to find rohan user")
        return
    
    rohan_user = None
    for user in users_data["users"]:
        if user.get("email") == USER_EMAIL:
            rohan_user = user
            break
    
    if not rohan_user:
        result.add_fail("F2.2 - Find rohan user", f"rohan@example.com not found in search results")
        return
    
    rohan_user_id = rohan_user["id"]
    result.add_pass("F2.2 - Find rohan user", f"Found rohan with ID: {rohan_user_id}")
    
    # Step 3: Admin resets rohan's password
    print(f"\n{YELLOW}Step 3: Admin resets rohan's password{RESET}")
    status, response = admin_reset_user_password(admin_token, rohan_user_id)
    if status == 200 and "temporary_password" in response:
        temp_password = response["temporary_password"]
        result.add_pass("F2.3 - Admin reset user password", f"Temp password: {temp_password}")
    else:
        result.add_fail("F2.3 - Admin reset user password", f"Status: {status}, Response: {response}")
        return
    
    # Step 4: Verify old password no longer works
    print(f"\n{YELLOW}Step 4: Verify rohan's old password no longer works{RESET}")
    old_login = login(USER_EMAIL, USER_PASSWORD)
    if old_login is None:
        result.add_pass("F2.4 - Old password rejected", "Login with Test@1234 correctly failed")
    else:
        result.add_fail("F2.4 - Old password rejected", "Old password still works - should have been rejected")
    
    # Step 5: Login with temp password and verify must_change_password=true
    print(f"\n{YELLOW}Step 5: Login with temp password and verify must_change_password=true{RESET}")
    temp_login = login(USER_EMAIL, temp_password)
    if not temp_login or not temp_login.get("token"):
        result.add_fail("F2.5 - Login with temp password", "Failed to login with temp password")
        return
    
    user_data = temp_login.get("user", {})
    if user_data.get("must_change_password") == True:
        result.add_pass("F2.5 - Login with temp password", f"must_change_password=true in login response")
    else:
        result.add_fail("F2.5 - Login with temp password", f"must_change_password={user_data.get('must_change_password')} (expected true)")
    
    rohan_token = temp_login["token"]
    
    # Step 6: Call /auth/me and verify must_change_password=true
    print(f"\n{YELLOW}Step 6: Call /auth/me and verify must_change_password=true{RESET}")
    me_data = get_me(rohan_token)
    if me_data and me_data.get("must_change_password") == True:
        result.add_pass("F2.6 - GET /auth/me shows must_change_password=true", "Confirmed")
    else:
        result.add_fail("F2.6 - GET /auth/me shows must_change_password=true", f"must_change_password={me_data.get('must_change_password') if me_data else 'N/A'}")
    
    # Step 7: Change password to NewSecure@123
    print(f"\n{YELLOW}Step 7: Change password to NewSecure@123{RESET}")
    status, response = change_password(rohan_token, temp_password, "NewSecure@123")
    if status == 200 and "Password changed successfully" in str(response):
        result.add_pass("F2.7 - Change password to NewSecure@123", f"Response: {response}")
    else:
        result.add_fail("F2.7 - Change password to NewSecure@123", f"Status: {status}, Response: {response}")
        return
    
    # Step 8: Call /auth/me again and verify must_change_password=false
    print(f"\n{YELLOW}Step 8: Call /auth/me and verify must_change_password=false{RESET}")
    me_data_after = get_me(rohan_token)
    if me_data_after and me_data_after.get("must_change_password") == False:
        result.add_pass("F2.8 - GET /auth/me shows must_change_password=false", "Confirmed")
    else:
        result.add_fail("F2.8 - GET /auth/me shows must_change_password=false", f"must_change_password={me_data_after.get('must_change_password') if me_data_after else 'N/A'}")
    
    # Step 9: Verify temp password no longer works and new password works
    print(f"\n{YELLOW}Step 9: Verify temp password no longer works{RESET}")
    temp_login_retry = login(USER_EMAIL, temp_password)
    if temp_login_retry is None:
        result.add_pass("F2.9 - Temp password rejected", "Login with temp password correctly failed")
    else:
        result.add_fail("F2.9 - Temp password rejected", "Temp password still works - should have been rejected")
    
    print(f"\n{YELLOW}Step 10: Verify new password (NewSecure@123) works{RESET}")
    new_login = login(USER_EMAIL, "NewSecure@123")
    if new_login and new_login.get("token"):
        result.add_pass("F2.10 - New password works", "Login successful with NewSecure@123")
    else:
        result.add_fail("F2.10 - New password works", "Failed to login with new password")
        return
    
    # Step 11: Edge case - Try to reset admin's own password
    print(f"\n{YELLOW}Step 11: Edge case - Try to reset admin's own password{RESET}")
    status, response = admin_reset_user_password(admin_token, admin_user_id)
    if status == 400 and "Cannot reset password for an admin account" in str(response):
        result.add_pass("F2.11 - Block admin password reset", f"Correctly blocked with 400: {response}")
    else:
        result.add_fail("F2.11 - Block admin password reset", f"Status: {status}, Response: {response} (expected 400 with 'Cannot reset password for an admin account')")
    
    # Step 12: Edge case - Try to reset password without admin token
    print(f"\n{YELLOW}Step 12: Edge case - Try to reset password without admin auth{RESET}")
    status, response = admin_reset_user_password(new_login["token"], rohan_user_id)
    if status in [401, 403]:
        result.add_pass("F2.12 - Reject non-admin reset attempt", f"Correctly rejected with {status}")
    else:
        result.add_fail("F2.12 - Reject non-admin reset attempt", f"Status: {status}, Response: {response} (expected 401/403)")
    
    # Step 13: IMPORTANT CLEANUP - Restore rohan's password to Test@1234
    print(f"\n{YELLOW}Step 13: CLEANUP - Restore rohan's password to Test@1234{RESET}")
    status, response = change_password(new_login["token"], "NewSecure@123", USER_PASSWORD)
    if status == 200 and "Password changed successfully" in str(response):
        result.add_pass("F2.13 - Restore rohan's password to Test@1234", f"Response: {response}")
    else:
        result.add_fail("F2.13 - Restore rohan's password to Test@1234", f"Status: {status}, Response: {response}")
        return
    
    # Step 14: Verify restored password works
    print(f"\n{YELLOW}Step 14: Verify restored password (Test@1234) works{RESET}")
    restored_login = login(USER_EMAIL, USER_PASSWORD)
    if restored_login and restored_login.get("token"):
        result.add_pass("F2.14 - Restored password works", "Login successful with Test@1234")
    else:
        result.add_fail("F2.14 - Restored password works", "Failed to login with restored password")


def main():
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Backend API Testing - Admin Password Features{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"User: {USER_EMAIL}")
    
    result = TestResult()
    
    # Test Feature 1
    test_feature_1_admin_change_password(result)
    
    # Test Feature 2
    test_feature_2_admin_reset_user_password(result)
    
    # Print summary
    success = result.summary()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
