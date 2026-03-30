#!/usr/bin/env python3
"""
CrewBook Backend API Testing
Testing specific fixes for admin user profile gigs and profile page load
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# API Configuration
BASE_URL = "https://code-review-218.preview.emergentagent.com/api"

# Test Credentials
ADMIN_CREDENTIALS = {
    "email": "admin@crewbook.in",
    "password": "Admin@123"
}

USER_CREDENTIALS = {
    "email": "testmobile@crewbook.in", 
    "password": "Test@1234"
}

class CrewBookTester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data if not success else None
        })
    
    def login_admin(self) -> bool:
        """Login as admin and get token"""
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=ADMIN_CREDENTIALS,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data:
                    self.admin_token = data["token"]
                    self.log_test("Admin Login", True, f"Successfully logged in as {ADMIN_CREDENTIALS['email']}")
                    return True
                elif "access_token" in data:
                    self.admin_token = data["access_token"]
                    self.log_test("Admin Login", True, f"Successfully logged in as {ADMIN_CREDENTIALS['email']}")
                    return True
                else:
                    self.log_test("Admin Login", False, "No token or access_token in response", data)
                    return False
            else:
                self.log_test("Admin Login", False, f"HTTP {response.status_code}: {response.text}", response.json() if response.text else None)
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def login_user(self) -> bool:
        """Login as regular user and get token"""
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=USER_CREDENTIALS,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data:
                    self.user_token = data["token"]
                    # Also extract user_id from token payload if available
                    if "user" in data and "id" in data["user"]:
                        self.user_id = data["user"]["id"]
                    self.log_test("User Login", True, f"Successfully logged in as {USER_CREDENTIALS['email']}")
                    return True
                elif "access_token" in data:
                    self.user_token = data["access_token"]
                    # Also extract user_id from token payload if available
                    if "user" in data and "id" in data["user"]:
                        self.user_id = data["user"]["id"]
                    self.log_test("User Login", True, f"Successfully logged in as {USER_CREDENTIALS['email']}")
                    return True
                else:
                    self.log_test("User Login", False, "No token or access_token in response", data)
                    return False
            else:
                self.log_test("User Login", False, f"HTTP {response.status_code}: {response.text}", response.json() if response.text else None)
                return False
                
        except Exception as e:
            self.log_test("User Login", False, f"Exception: {str(e)}")
            return False
    
    def get_admin_users_list(self) -> Optional[str]:
        """Get list of users from admin endpoint and return first user ID"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{BASE_URL}/admin/users",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check if users are in a 'users' field or direct array
                users_list = data.get("users", data) if isinstance(data, dict) else data
                
                if isinstance(users_list, list) and len(users_list) > 0:
                    # Get first user's ID
                    first_user = users_list[0]
                    if "id" in first_user:
                        user_id = first_user["id"]
                        self.log_test("Admin Users List", True, f"Retrieved {len(users_list)} users, first user ID: {user_id}")
                        return user_id
                    else:
                        self.log_test("Admin Users List", False, "First user has no 'id' field", first_user)
                        return None
                else:
                    self.log_test("Admin Users List", False, "Empty users list or invalid format", data)
                    return None
            else:
                self.log_test("Admin Users List", False, f"HTTP {response.status_code}: {response.text}", response.json() if response.text else None)
                return None
                
        except Exception as e:
            self.log_test("Admin Users List", False, f"Exception: {str(e)}")
            return None
    
    def test_admin_user_profile_gigs(self, user_id: str) -> bool:
        """Test admin user profile endpoint - should have 'gigs' field"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{BASE_URL}/admin/users/{user_id}/profile",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if 'gigs' field is present
                if "gigs" in data:
                    gigs_data = data["gigs"]
                    self.log_test(
                        "Admin User Profile - Gigs Field", 
                        True, 
                        f"✅ 'gigs' field present with {len(gigs_data) if isinstance(gigs_data, list) else 'non-list'} items"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin User Profile - Gigs Field", 
                        False, 
                        "❌ 'gigs' field missing from response", 
                        data
                    )
                    return False
            else:
                self.log_test(
                    "Admin User Profile - Gigs Field", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}", 
                    response.json() if response.text else None
                )
                return False
                
        except Exception as e:
            self.log_test("Admin User Profile - Gigs Field", False, f"Exception: {str(e)}")
            return False
    
    def test_user_own_profile(self) -> bool:
        """Test user's own profile endpoint"""
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # If we don't have user_id from login, try to get it from /auth/me
            if not self.user_id:
                me_response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
                if me_response.status_code == 200:
                    me_data = me_response.json()
                    if "id" in me_data:
                        self.user_id = me_data["id"]
                    else:
                        self.log_test("User Own Profile", False, "Could not get user ID from /auth/me", me_data)
                        return False
                else:
                    self.log_test("User Own Profile", False, f"Could not get user ID - /auth/me returned HTTP {me_response.status_code}")
                    return False
            
            # Now test the profile endpoint
            response = requests.get(
                f"{BASE_URL}/users/{self.user_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                # Basic validation - should have user data
                if "email" in data or "id" in data:
                    self.log_test(
                        "User Own Profile", 
                        True, 
                        f"✅ Profile data retrieved successfully for user {self.user_id}"
                    )
                    return True
                else:
                    self.log_test(
                        "User Own Profile", 
                        False, 
                        "Profile response missing basic user fields", 
                        data
                    )
                    return False
            else:
                self.log_test(
                    "User Own Profile", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}", 
                    response.json() if response.text else None
                )
                return False
                
        except Exception as e:
            self.log_test("User Own Profile", False, f"Exception: {str(e)}")
            return False
    
    def run_tests(self):
        """Run all tests"""
        print("=" * 60)
        print("CrewBook Backend API Testing")
        print("Testing admin user profile gigs fix and profile page load")
        print("=" * 60)
        print()
        
        # Test 1: Admin login
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return False
        
        # Test 2: Get users list
        user_id = self.get_admin_users_list()
        if not user_id:
            print("❌ Cannot proceed without user ID")
            return False
        
        # Test 3: Admin user profile with gigs field
        admin_profile_success = self.test_admin_user_profile_gigs(user_id)
        
        # Test 4: User login
        if not self.login_user():
            print("❌ Cannot test user profile without user login")
            user_profile_success = False
        else:
            # Test 5: User own profile
            user_profile_success = self.test_user_own_profile()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print()
        
        # Key Results
        print("KEY RESULTS:")
        print(f"1. Admin user profile gigs fix: {'✅ WORKING' if admin_profile_success else '❌ FAILED'}")
        print(f"2. User profile page load: {'✅ WORKING' if user_profile_success else '❌ FAILED'}")
        print()
        
        # Failed tests details
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("FAILED TESTS DETAILS:")
            for test in failed_tests:
                print(f"❌ {test['test']}: {test['details']}")
                if test['response']:
                    print(f"   Response: {json.dumps(test['response'], indent=2)}")
            print()
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = CrewBookTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)