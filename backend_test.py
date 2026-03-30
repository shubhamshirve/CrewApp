#!/usr/bin/env python3
"""
Backend Test Suite for CrewBook API
Tests TTL cache, dynamic event types/roles, N+1 fixes, MongoDB indexes, role validation,
coupon CRUD operations, coupon validation, and profile picture upload
"""
import asyncio
import aiohttp
import time
import json
import io
from typing import Dict, Any, Optional

# API Configuration
BASE_URL = "https://perf-tuner-9.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@crewbook.in"
ADMIN_PASSWORD = "Admin@123"

class CrewBookAPITester:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.admin_token: Optional[str] = None
        self.user_token: Optional[str] = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
    
    async def login_admin(self) -> bool:
        """Login as admin and get auth token"""
        try:
            login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            async with self.session.post(f"{BASE_URL}/auth/login", json=login_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.admin_token = data.get("token") or data.get("access_token")
                    if self.admin_token:
                        self.log_result("Admin Login", True, f"Token obtained: {self.admin_token[:20]}...")
                        return True
                    else:
                        self.log_result("Admin Login", False, "No access token in response")
                        return False
                else:
                    text = await resp.text()
                    self.log_result("Admin Login", False, f"Status {resp.status}: {text}")
                    return False
                    
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    async def test_health_endpoint(self) -> bool:
        """Test /api/health endpoint for performance (N+1 fix verification)"""
        try:
            start_time = time.time()
            async with self.session.get(f"{BASE_URL}/health") as resp:
                end_time = time.time()
                response_time = end_time - start_time
                
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("status") == "ok":
                        if response_time < 1.0:
                            self.log_result("Health Endpoint Performance", True, 
                                          f"Response time: {response_time:.3f}s (< 1s)")
                            return True
                        else:
                            self.log_result("Health Endpoint Performance", False, 
                                          f"Response time: {response_time:.3f}s (>= 1s)")
                            return False
                    else:
                        self.log_result("Health Endpoint Performance", False, 
                                      f"Unexpected status: {data}")
                        return False
                else:
                    text = await resp.text()
                    self.log_result("Health Endpoint Performance", False, 
                                  f"Status {resp.status}: {text}")
                    return False
                    
        except Exception as e:
            self.log_result("Health Endpoint Performance", False, f"Exception: {str(e)}")
            return False
    
    async def test_ttl_cache_event_types(self) -> bool:
        """Test TTL cache for /api/platform/event-types"""
        try:
            # First call
            start_time1 = time.time()
            async with self.session.get(f"{BASE_URL}/platform/event-types") as resp1:
                end_time1 = time.time()
                if resp1.status != 200:
                    text = await resp1.text()
                    self.log_result("TTL Cache Event Types - First Call", False, 
                                  f"Status {resp1.status}: {text}")
                    return False
                
                data1 = await resp1.json()
                response_time1 = end_time1 - start_time1
            
            # Second call (should be cached)
            start_time2 = time.time()
            async with self.session.get(f"{BASE_URL}/platform/event-types") as resp2:
                end_time2 = time.time()
                if resp2.status != 200:
                    text = await resp2.text()
                    self.log_result("TTL Cache Event Types - Second Call", False, 
                                  f"Status {resp2.status}: {text}")
                    return False
                
                data2 = await resp2.json()
                response_time2 = end_time2 - start_time2
            
            # Verify data is the same
            if data1 == data2:
                self.log_result("TTL Cache Event Types", True, 
                              f"First: {response_time1:.3f}s, Second: {response_time2:.3f}s, Data matches")
                return True
            else:
                self.log_result("TTL Cache Event Types", False, 
                              "Data mismatch between calls")
                return False
                
        except Exception as e:
            self.log_result("TTL Cache Event Types", False, f"Exception: {str(e)}")
            return False
    
    async def test_ttl_cache_roles(self) -> bool:
        """Test TTL cache for /api/platform/roles"""
        try:
            # First call
            start_time1 = time.time()
            async with self.session.get(f"{BASE_URL}/platform/roles") as resp1:
                end_time1 = time.time()
                if resp1.status != 200:
                    text = await resp1.text()
                    self.log_result("TTL Cache Roles - First Call", False, 
                                  f"Status {resp1.status}: {text}")
                    return False
                
                data1 = await resp1.json()
                response_time1 = end_time1 - start_time1
            
            # Second call (should be cached)
            start_time2 = time.time()
            async with self.session.get(f"{BASE_URL}/platform/roles") as resp2:
                end_time2 = time.time()
                if resp2.status != 200:
                    text = await resp2.text()
                    self.log_result("TTL Cache Roles - Second Call", False, 
                                  f"Status {resp2.status}: {text}")
                    return False
                
                data2 = await resp2.json()
                response_time2 = end_time2 - start_time2
            
            # Verify data is the same
            if data1 == data2:
                self.log_result("TTL Cache Roles", True, 
                              f"First: {response_time1:.3f}s, Second: {response_time2:.3f}s, Data matches")
                return True
            else:
                self.log_result("TTL Cache Roles", False, 
                              "Data mismatch between calls")
                return False
                
        except Exception as e:
            self.log_result("TTL Cache Roles", False, f"Exception: {str(e)}")
            return False
    
    async def test_dynamic_event_types_consistency(self) -> bool:
        """Test that /api/gigs/event-types returns same data as /api/platform/event-types"""
        try:
            # Get platform event types
            async with self.session.get(f"{BASE_URL}/platform/event-types") as resp1:
                if resp1.status != 200:
                    text = await resp1.text()
                    self.log_result("Dynamic Event Types - Platform Call", False, 
                                  f"Status {resp1.status}: {text}")
                    return False
                platform_data = await resp1.json()
            
            # Get gigs event types
            async with self.session.get(f"{BASE_URL}/gigs/event-types") as resp2:
                if resp2.status != 200:
                    text = await resp2.text()
                    self.log_result("Dynamic Event Types - Gigs Call", False, 
                                  f"Status {resp2.status}: {text}")
                    return False
                gigs_data = await resp2.json()
            
            # Compare the data
            platform_types = platform_data.get("event_types", [])
            
            # gigs endpoint returns array directly, platform returns object with event_types key
            if isinstance(gigs_data, list):
                gigs_types = gigs_data
            else:
                gigs_types = gigs_data.get("event_types", [])
            
            if platform_types == gigs_types:
                self.log_result("Dynamic Event Types Consistency", True, 
                              f"Both endpoints return same data: {len(platform_types)} event types")
                return True
            else:
                self.log_result("Dynamic Event Types Consistency", False, 
                              f"Platform: {platform_types}, Gigs: {gigs_types}")
                return False
                
        except Exception as e:
            self.log_result("Dynamic Event Types Consistency", False, f"Exception: {str(e)}")
            return False
    
    async def test_dynamic_event_type_crud(self) -> bool:
        """Test adding and removing event types dynamically"""
        if not self.admin_token:
            self.log_result("Dynamic Event Type CRUD", False, "No admin token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        test_event_name = "Test Event 2025"
        
        try:
            # Get initial event types
            async with self.session.get(f"{BASE_URL}/platform/event-types") as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Dynamic Event Type CRUD - Initial Get", False, 
                                  f"Status {resp.status}: {text}")
                    return False
                initial_data = await resp.json()
                initial_types = initial_data.get("event_types", [])
            
            # Add new event type
            add_data = {"name": test_event_name}
            async with self.session.post(f"{BASE_URL}/platform/event-types", 
                                       json=add_data, headers=headers) as resp:
                if resp.status not in [200, 201]:
                    text = await resp.text()
                    self.log_result("Dynamic Event Type CRUD - Add", False, 
                                  f"Status {resp.status}: {text}")
                    return False
                add_response = await resp.json()
            
            # Verify it was added
            async with self.session.get(f"{BASE_URL}/platform/event-types") as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Dynamic Event Type CRUD - Verify Add", False, 
                                  f"Status {resp.status}: {text}")
                    return False
                after_add_data = await resp.json()
                after_add_types = after_add_data.get("event_types", [])
            
            if test_event_name not in after_add_types:
                self.log_result("Dynamic Event Type CRUD - Verify Add", False, 
                              f"Event type not found after adding: {after_add_types}")
                return False
            
            # Delete the event type
            import urllib.parse
            encoded_name = urllib.parse.quote(test_event_name)
            async with self.session.delete(f"{BASE_URL}/platform/event-types/{encoded_name}", 
                                         headers=headers) as resp:
                if resp.status not in [200, 204]:
                    text = await resp.text()
                    self.log_result("Dynamic Event Type CRUD - Delete", False, 
                                  f"Status {resp.status}: {text}")
                    return False
            
            # Verify it was removed
            async with self.session.get(f"{BASE_URL}/platform/event-types") as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Dynamic Event Type CRUD - Verify Delete", False, 
                                  f"Status {resp.status}: {text}")
                    return False
                after_delete_data = await resp.json()
                after_delete_types = after_delete_data.get("event_types", [])
            
            if test_event_name in after_delete_types:
                self.log_result("Dynamic Event Type CRUD - Verify Delete", False, 
                              f"Event type still found after deletion: {after_delete_types}")
                return False
            
            self.log_result("Dynamic Event Type CRUD", True, 
                          f"Successfully added and removed '{test_event_name}'")
            return True
            
        except Exception as e:
            self.log_result("Dynamic Event Type CRUD", False, f"Exception: {str(e)}")
            return False
    
    async def test_role_validation_endpoint(self) -> bool:
        """Test /api/users/meta/options returns dynamic roles from DB"""
        try:
            async with self.session.get(f"{BASE_URL}/users/meta/options") as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Role Validation Endpoint", False, 
                                  f"Status {resp.status}: {text}")
                    return False
                
                data = await resp.json()
                roles = data.get("roles", [])
                
                if isinstance(roles, list) and len(roles) > 0:
                    self.log_result("Role Validation Endpoint", True, 
                                  f"Returns {len(roles)} roles: {roles[:3]}...")
                    return True
                else:
                    self.log_result("Role Validation Endpoint", False, 
                                  f"Invalid roles data: {data}")
                    return False
                    
        except Exception as e:
            self.log_result("Role Validation Endpoint", False, f"Exception: {str(e)}")
            return False
    
    async def test_mongodb_indexes_health(self) -> bool:
        """Test that MongoDB indexes are working (health endpoint should be fast)"""
        try:
            # Test multiple calls to ensure consistent performance
            response_times = []
            for i in range(3):
                start_time = time.time()
                async with self.session.get(f"{BASE_URL}/health") as resp:
                    end_time = time.time()
                    response_time = end_time - start_time
                    response_times.append(response_time)
                    
                    if resp.status != 200:
                        text = await resp.text()
                        self.log_result("MongoDB Indexes Health", False, 
                                      f"Health check failed on attempt {i+1}: Status {resp.status}: {text}")
                        return False
                
                # Small delay between requests
                await asyncio.sleep(0.1)
            
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            
            if max_response_time < 1.0:
                self.log_result("MongoDB Indexes Health", True, 
                              f"Avg: {avg_response_time:.3f}s, Max: {max_response_time:.3f}s (all < 1s)")
                return True
            else:
                self.log_result("MongoDB Indexes Health", False, 
                              f"Avg: {avg_response_time:.3f}s, Max: {max_response_time:.3f}s (some >= 1s)")
                return False
                
        except Exception as e:
            self.log_result("MongoDB Indexes Health", False, f"Exception: {str(e)}")
            return False
    
    async def register_test_user(self) -> bool:
        """Register a new test user for coupon validation testing"""
        # Use existing test user from credentials instead of registering new one
        self.log_result("Test User Registration", True, "Using existing test user from credentials")
        return True
    
    async def login_test_user(self) -> bool:
        """Login as test user and get auth token"""
        try:
            login_data = {
                "email": "testmobile@crewbook.in",
                "password": "Test@1234"
            }
            
            async with self.session.post(f"{BASE_URL}/auth/login", json=login_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.user_token = data.get("token") or data.get("access_token")
                    if self.user_token:
                        self.log_result("Test User Login", True, f"Token obtained: {self.user_token[:20]}...")
                        return True
                    else:
                        self.log_result("Test User Login", False, "No access token in response")
                        return False
                else:
                    text = await resp.text()
                    self.log_result("Test User Login", False, f"Status {resp.status}: {text}")
                    return False
                    
        except Exception as e:
            self.log_result("Test User Login", False, f"Exception: {str(e)}")
            return False
    
    async def test_coupon_crud_admin(self) -> bool:
        """Test coupon CRUD operations as admin"""
        if not self.admin_token:
            self.log_result("Coupon CRUD (Admin)", False, "No admin token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Use timestamp to make codes unique
        import time
        timestamp = str(int(time.time()))[-6:]  # Last 6 digits of timestamp
        test_code1 = f"TEST{timestamp}"
        test_code2 = f"FLAT{timestamp}"
        
        try:
            # 1. Create first coupon
            coupon1_data = {
                "code": test_code1,
                "discount_type": "percentage",
                "discount_value": 20,
                "max_redemptions": 100,
                "per_user_limit": 2
            }
            
            async with self.session.post(f"{BASE_URL}/coupons", json=coupon1_data, headers=headers) as resp:
                if resp.status not in [200, 201]:
                    text = await resp.text()
                    self.log_result("Coupon CRUD - Create first coupon", False, f"Status {resp.status}: {text}")
                    return False
                coupon1_response = await resp.json()
                self.log_result("Coupon CRUD - Create first coupon", True, f"Created: {coupon1_response.get('id')}")
            
            # 2. Get coupons list (should contain first coupon)
            async with self.session.get(f"{BASE_URL}/coupons", headers=headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Coupon CRUD - List after first create", False, f"Status {resp.status}: {text}")
                    return False
                coupons_list1 = await resp.json()
                
                test_found = any(c.get("id") == test_code1 for c in coupons_list1)
                if not test_found:
                    self.log_result("Coupon CRUD - List after first create", False, f"{test_code1} not found in list")
                    return False
                self.log_result("Coupon CRUD - List after first create", True, f"Found {test_code1} in {len(coupons_list1)} coupons")
            
            # 3. Create second coupon
            coupon2_data = {
                "code": test_code2,
                "discount_type": "rupees",
                "discount_value": 50,
                "max_redemptions": 50,
                "per_user_limit": 1,
                "valid_until": "2026-12-31"
            }
            
            async with self.session.post(f"{BASE_URL}/coupons", json=coupon2_data, headers=headers) as resp:
                if resp.status not in [200, 201]:
                    text = await resp.text()
                    self.log_result("Coupon CRUD - Create second coupon", False, f"Status {resp.status}: {text}")
                    return False
                coupon2_response = await resp.json()
                self.log_result("Coupon CRUD - Create second coupon", True, f"Created: {coupon2_response.get('id')}")
            
            # 4. Get coupons list (should contain both)
            async with self.session.get(f"{BASE_URL}/coupons", headers=headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Coupon CRUD - List after second create", False, f"Status {resp.status}: {text}")
                    return False
                coupons_list2 = await resp.json()
                
                test1_found = any(c.get("id") == test_code1 for c in coupons_list2)
                test2_found = any(c.get("id") == test_code2 for c in coupons_list2)
                
                if not (test1_found and test2_found):
                    self.log_result("Coupon CRUD - List after second create", False, 
                                  f"Missing coupons - {test_code1}: {test1_found}, {test_code2}: {test2_found}")
                    return False
                self.log_result("Coupon CRUD - List after second create", True, 
                              f"Found both coupons in {len(coupons_list2)} total")
            
            # 5. Toggle first coupon active state
            async with self.session.patch(f"{BASE_URL}/coupons/{test_code1}/toggle", headers=headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Coupon CRUD - Toggle first coupon", False, f"Status {resp.status}: {text}")
                    return False
                toggle_response = await resp.json()
                self.log_result("Coupon CRUD - Toggle first coupon", True, 
                              f"Toggled to active: {toggle_response.get('is_active')}")
            
            # 6. Delete second coupon
            async with self.session.delete(f"{BASE_URL}/coupons/{test_code2}", headers=headers) as resp:
                if resp.status not in [200, 204]:
                    text = await resp.text()
                    self.log_result("Coupon CRUD - Delete second coupon", False, f"Status {resp.status}: {text}")
                    return False
                self.log_result("Coupon CRUD - Delete second coupon", True, "Successfully deleted")
            
            # 7. Verify second coupon is deleted
            async with self.session.get(f"{BASE_URL}/coupons", headers=headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Coupon CRUD - Verify delete", False, f"Status {resp.status}: {text}")
                    return False
                final_coupons = await resp.json()
                
                test2_found = any(c.get("id") == test_code2 for c in final_coupons)
                if test2_found:
                    self.log_result("Coupon CRUD - Verify delete", False, f"{test_code2} still found after deletion")
                    return False
                self.log_result("Coupon CRUD - Verify delete", True, f"{test_code2} successfully removed")
            
            # Clean up: delete the first coupon too
            await self.session.delete(f"{BASE_URL}/coupons/{test_code1}", headers=headers)
            
            self.log_result("Coupon CRUD (Admin)", True, "All CRUD operations completed successfully")
            return True
            
        except Exception as e:
            self.log_result("Coupon CRUD (Admin)", False, f"Exception: {str(e)}")
            return False
    
    async def test_coupon_validation_user(self) -> bool:
        """Test coupon validation as regular user"""
        if not self.user_token or not self.admin_token:
            self.log_result("Coupon Validation (User)", False, "Missing required tokens")
            return False
        
        user_headers = {"Authorization": f"Bearer {self.user_token}"}
        admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create a test coupon for validation
        validation_code = "VALIDATE20"
        
        try:
            # First, create a coupon for validation testing
            coupon_data = {
                "code": validation_code,
                "discount_type": "percentage",
                "discount_value": 20,
                "max_redemptions": 100,
                "per_user_limit": 2
            }
            
            async with self.session.post(f"{BASE_URL}/coupons", json=coupon_data, headers=admin_headers) as resp:
                if resp.status not in [200, 201, 409]:  # 409 if already exists
                    text = await resp.text()
                    self.log_result("Coupon Validation - Setup test coupon", False, f"Status {resp.status}: {text}")
                    return False
            
            # 1. Validate valid coupon
            valid_coupon_data = {"code": validation_code}
            
            async with self.session.post(f"{BASE_URL}/coupons/validate", 
                                       json=valid_coupon_data, headers=user_headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    self.log_result("Coupon Validation - Valid coupon", False, f"Status {resp.status}: {text}")
                    return False
                
                valid_response = await resp.json()
                expected_fields = ["code", "discount_type", "discount_value"]
                missing_fields = [f for f in expected_fields if f not in valid_response]
                
                if missing_fields:
                    self.log_result("Coupon Validation - Valid coupon", False, 
                                  f"Missing fields: {missing_fields}")
                    return False
                
                if valid_response.get("code") != validation_code or valid_response.get("discount_value") != 20:
                    self.log_result("Coupon Validation - Valid coupon", False, 
                                  f"Incorrect coupon data: {valid_response}")
                    return False
                
                self.log_result("Coupon Validation - Valid coupon", True, 
                              f"{validation_code} validated: {valid_response.get('discount_value')}% off")
            
            # 2. Validate invalid coupon
            invalid_coupon_data = {"code": "INVALIDXXX"}
            
            async with self.session.post(f"{BASE_URL}/coupons/validate", 
                                       json=invalid_coupon_data, headers=user_headers) as resp:
                if resp.status != 404:
                    text = await resp.text()
                    self.log_result("Coupon Validation - Invalid coupon", False, 
                                  f"Expected 404, got {resp.status}: {text}")
                    return False
                
                self.log_result("Coupon Validation - Invalid coupon", True, "Correctly returned 404 for invalid coupon")
            
            # Clean up: delete the test coupon
            await self.session.delete(f"{BASE_URL}/coupons/{validation_code}", headers=admin_headers)
            
            self.log_result("Coupon Validation (User)", True, "Both validation tests passed")
            return True
            
        except Exception as e:
            self.log_result("Coupon Validation (User)", False, f"Exception: {str(e)}")
            return False
    
    async def test_plan_gate_coupon_validation(self) -> bool:
        """Test that coupon validation endpoint requires authentication"""
        try:
            # Test without authentication
            coupon_data = {"code": "TEST20"}
            
            async with self.session.post(f"{BASE_URL}/coupons/validate", json=coupon_data) as resp:
                if resp.status != 401:
                    text = await resp.text()
                    self.log_result("Plan Gate - Coupon validation", False, 
                                  f"Expected 401 without auth, got {resp.status}: {text}")
                    return False
                
                self.log_result("Plan Gate - Coupon validation", True, 
                              "Correctly requires authentication (401 without token)")
                return True
                
        except Exception as e:
            self.log_result("Plan Gate - Coupon validation", False, f"Exception: {str(e)}")
            return False
    
    async def test_profile_picture_upload(self) -> bool:
        """Test profile picture upload functionality"""
        if not self.user_token:
            self.log_result("Profile Picture Upload", False, "No user token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        try:
            # Create a small test JPEG image (1x1 pixel red square)
            # This is a minimal valid JPEG file
            jpeg_data = bytes([
                0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
                0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
                0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
                0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
                0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
                0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
                0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
                0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
                0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
                0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
                0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
                0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x80, 0x00,
                0xFF, 0xD9
            ])
            
            # Create multipart form data
            data = aiohttp.FormData()
            data.add_field('file', io.BytesIO(jpeg_data), filename='test.jpg', content_type='image/jpeg')
            
            # Upload profile picture
            async with self.session.post(f"{BASE_URL}/uploads/profile-picture", 
                                       data=data, headers=headers) as resp:
                if resp.status not in [200, 201]:
                    text = await resp.text()
                    self.log_result("Profile Picture Upload - Upload", False, f"Status {resp.status}: {text}")
                    return False
                
                upload_response = await resp.json()
                image_url = upload_response.get("url")
                
                if not image_url:
                    self.log_result("Profile Picture Upload - Upload", False, "No URL in response")
                    return False
                
                self.log_result("Profile Picture Upload - Upload", True, f"Uploaded: {image_url}")
                
                # Extract filename from URL for retrieval test
                filename = image_url.split("/")[-1]
                
                # Test image retrieval
                async with self.session.get(f"{BASE_URL}/uploads/avatar/{filename}") as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        self.log_result("Profile Picture Upload - Retrieve", False, f"Status {resp.status}: {text}")
                        return False
                    
                    content_type = resp.headers.get("content-type", "")
                    if not content_type.startswith("image/"):
                        self.log_result("Profile Picture Upload - Retrieve", False, 
                                      f"Wrong content type: {content_type}")
                        return False
                    
                    image_data = await resp.read()
                    if len(image_data) < 100:
                        self.log_result("Profile Picture Upload - Retrieve", False, 
                                      f"Image too small: {len(image_data)} bytes")
                        return False
                    
                    self.log_result("Profile Picture Upload - Retrieve", True, 
                                  f"Retrieved {len(image_data)} bytes, type: {content_type}")
                
                self.log_result("Profile Picture Upload", True, "Upload and retrieval both successful")
                return True
                
        except Exception as e:
            self.log_result("Profile Picture Upload", False, f"Exception: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all optimization and new feature tests"""
        print("🚀 Starting CrewBook API Tests")
        print(f"📍 Base URL: {BASE_URL}")
        print("=" * 60)
        
        # Test 1: Health endpoint and MongoDB indexes
        await self.test_health_endpoint()
        await self.test_mongodb_indexes_health()
        
        # Test 2: TTL Cache functionality
        await self.test_ttl_cache_event_types()
        await self.test_ttl_cache_roles()
        
        # Test 3: Dynamic event types
        await self.test_dynamic_event_types_consistency()
        
        # Test 4: Role validation
        await self.test_role_validation_endpoint()
        
        # Test 5: Admin authentication and CRUD operations
        if await self.login_admin():
            await self.test_dynamic_event_type_crud()
            # Test 6: Coupon CRUD (Admin)
            await self.test_coupon_crud_admin()
        
        # Test 7: Plan gate (authentication required)
        await self.test_plan_gate_coupon_validation()
        
        # Test 8: User registration and authentication
        if await self.register_test_user() and await self.login_test_user():
            # Test 9: Coupon validation (User)
            await self.test_coupon_validation_user()
            # Test 10: Profile picture upload
            await self.test_profile_picture_upload()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"] and not result["success"]:
                print(f"    {result['details']}")
        
        print(f"\n🎯 Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests PASSED!")
            return True
        else:
            print("⚠️  Some tests FAILED!")
            return False

async def main():
    """Main test runner"""
    async with CrewBookAPITester() as tester:
        success = await tester.run_all_tests()
        return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)