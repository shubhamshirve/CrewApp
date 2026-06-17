#!/usr/bin/env python3
"""
Additional test to verify cache invalidation works properly
"""
import asyncio
import aiohttp
import json

BASE_URL = "https://code-analyzer-443.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@photoo.in"
ADMIN_PASSWORD = "Admin@123"

async def test_cache_invalidation():
    """Test that cache is properly invalidated when admin makes changes"""
    async with aiohttp.ClientSession() as session:
        # Login as admin
        login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        async with session.post(f"{BASE_URL}/auth/login", json=login_data) as resp:
            if resp.status != 200:
                print("❌ Admin login failed")
                return False
            data = await resp.json()
            admin_token = data.get("token")
            if not admin_token:
                print("❌ No admin token received")
                return False
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get initial event types (this will cache them)
        async with session.get(f"{BASE_URL}/platform/event-types") as resp:
            if resp.status != 200:
                print("❌ Failed to get initial event types")
                return False
            initial_data = await resp.json()
            initial_types = initial_data.get("event_types", [])
            print(f"✅ Initial event types: {len(initial_types)} items")
        
        # Add a new event type (this should invalidate cache)
        test_event = "Cache Test Event"
        add_data = {"name": test_event}
        async with session.post(f"{BASE_URL}/platform/event-types", 
                               json=add_data, headers=headers) as resp:
            if resp.status not in [200, 201]:
                print(f"❌ Failed to add event type: {resp.status}")
                return False
            print(f"✅ Added event type: {test_event}")
        
        # Get event types again (should show new item immediately, not cached)
        async with session.get(f"{BASE_URL}/platform/event-types") as resp:
            if resp.status != 200:
                print("❌ Failed to get updated event types")
                return False
            updated_data = await resp.json()
            updated_types = updated_data.get("event_types", [])
            
            if test_event in updated_types:
                print(f"✅ Cache invalidation working: new event type appears immediately")
            else:
                print(f"❌ Cache invalidation failed: new event type not found")
                return False
        
        # Verify /api/gigs/event-types also shows the new event type
        async with session.get(f"{BASE_URL}/gigs/event-types") as resp:
            if resp.status != 200:
                print("❌ Failed to get gigs event types")
                return False
            gigs_types = await resp.json()
            
            if isinstance(gigs_types, list):
                gigs_event_list = gigs_types
            else:
                gigs_event_list = gigs_types.get("event_types", [])
            
            if test_event in gigs_event_list:
                print(f"✅ Gigs endpoint also shows new event type")
            else:
                print(f"❌ Gigs endpoint doesn't show new event type")
                return False
        
        # Clean up - remove the test event type
        import urllib.parse
        encoded_name = urllib.parse.quote(test_event)
        async with session.delete(f"{BASE_URL}/platform/event-types/{encoded_name}", 
                                 headers=headers) as resp:
            if resp.status not in [200, 204]:
                print(f"❌ Failed to delete test event type: {resp.status}")
                return False
            print(f"✅ Cleaned up test event type")
        
        return True

async def main():
    print("🔄 Testing Cache Invalidation...")
    success = await test_cache_invalidation()
    if success:
        print("🎉 Cache invalidation test PASSED!")
    else:
        print("⚠️ Cache invalidation test FAILED!")
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)