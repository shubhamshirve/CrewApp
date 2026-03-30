#!/usr/bin/env python3
"""
Backend Test Suite for CrewBook API Optimizations
Tests TTL cache, dynamic event types/roles, N+1 fixes, MongoDB indexes, and role validation
"""
import asyncio
import aiohttp
import time
import json
from typing import Dict, Any, Optional

# API Configuration
BASE_URL = "https://perf-tuner-9.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@crewbook.in"
ADMIN_PASSWORD = "Admin@123"

class CrewBookAPITester:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.admin_token: Optional[str] = None
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
    
    async def run_all_tests(self):
        """Run all optimization tests"""
        print("🚀 Starting CrewBook API Optimization Tests")
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
            print("🎉 All optimization tests PASSED!")
            return True
        else:
            print("⚠️  Some optimization tests FAILED!")
            return False

async def main():
    """Main test runner"""
    async with CrewBookAPITester() as tester:
        success = await tester.run_all_tests()
        return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)