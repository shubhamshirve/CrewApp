"""
Tests for Admin Plans Management and Plan-based Feature Gating
Tests: Plans CRUD, Feature gating on GigBoard, Wallet dynamic plans
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    """Get admin JWT token"""
    # Ensure admin exists
    requests.post(f"{BASE_URL}/api/admin/seed-admin")
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@crewbook.in",
        "password": "Admin@123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin auth failed: {response.status_code} {response.text}")

@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="module")
def lead_token():
    """Get lead user JWT token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "lead_test@test.com",
        "password": "Test@1234"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Lead auth failed: {response.status_code} {response.text}")

@pytest.fixture(scope="module")
def lead_headers(lead_token):
    return {"Authorization": f"Bearer {lead_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="module")
def freelancer_token():
    """Get freelancer JWT token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "freelancer_test@test.com",
        "password": "Test@1234"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Freelancer auth failed: {response.status_code} {response.text}")

@pytest.fixture(scope="module")
def freelancer_headers(freelancer_token):
    return {"Authorization": f"Bearer {freelancer_token}", "Content-Type": "application/json"}


# ── Health Check ──────────────────────────────────────────────────────────────

class TestHealth:
    """Basic health check"""

    def test_api_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        print(f"PASS: Health check ok - {data}")


# ── Public Plans Endpoint ─────────────────────────────────────────────────────

class TestPublicPlans:
    """GET /api/plans - public endpoint, no auth required"""

    def test_get_plans_no_auth(self):
        """Public endpoint should work without auth"""
        r = requests.get(f"{BASE_URL}/api/plans")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "plans" in data
        assert isinstance(data["plans"], list)
        print(f"PASS: GET /api/plans returned {len(data['plans'])} active plans")

    def test_get_plans_structure(self):
        """Each plan should have correct fields"""
        r = requests.get(f"{BASE_URL}/api/plans")
        assert r.status_code == 200
        data = r.json()
        for plan in data["plans"]:
            assert "id" in plan
            assert "name" in plan
            assert "price" in plan
            assert "features" in plan
            assert "is_active" in plan
            assert plan["is_active"] is True, "Public endpoint should only return active plans"
        print(f"PASS: All active plans have correct structure")


# ── Admin Plans CRUD ──────────────────────────────────────────────────────────

class TestAdminPlans:
    """Admin CRUD operations on plans"""
    created_plan_id = None

    def test_admin_list_all_plans(self, admin_headers):
        """GET /api/plans/admin/all - admin sees all plans"""
        r = requests.get(f"{BASE_URL}/api/plans/admin/all", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "plans" in data
        assert isinstance(data["plans"], list)
        print(f"PASS: Admin can list all plans: {len(data['plans'])} total")

    def test_admin_list_plans_requires_auth(self):
        """Admin endpoint should reject unauthenticated requests"""
        r = requests.get(f"{BASE_URL}/api/plans/admin/all")
        assert r.status_code in [401, 403], f"Expected 401/403 without auth, got {r.status_code}"
        print(f"PASS: Admin endpoint correctly rejects unauthenticated access")

    def test_create_plan_basic(self, admin_headers):
        """POST /api/plans/admin - create a basic plan"""
        payload = {
            "name": "TEST_Basic Plan",
            "price": 99.0,
            "description": "Test basic plan for testing",
            "features": {"public_gig_enabled": False, "whatsapp_enabled": False},
            "is_active": True,
            "sort_order": 99
        }
        r = requests.post(f"{BASE_URL}/api/plans/admin", json=payload, headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "plan" in data
        assert data["plan"]["name"] == "TEST_Basic Plan"
        assert data["plan"]["price"] == 99.0
        assert data["plan"]["features"]["public_gig_enabled"] is False
        assert "id" in data["plan"]
        assert data.get("migrated_users") == 0
        TestAdminPlans.created_plan_id = data["plan"]["id"]
        print(f"PASS: Created plan with ID: {TestAdminPlans.created_plan_id}")

    def test_create_plan_with_gig_access(self, admin_headers):
        """Create plan with public_gig_enabled=True"""
        payload = {
            "name": "TEST_Premium Gig Plan",
            "price": 299.0,
            "description": "Test plan with gig board access",
            "features": {"public_gig_enabled": True, "whatsapp_enabled": True},
            "is_active": True,
            "sort_order": 100
        }
        r = requests.post(f"{BASE_URL}/api/plans/admin", json=payload, headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["plan"]["features"]["public_gig_enabled"] is True
        assert data["plan"]["features"]["whatsapp_enabled"] is True
        print(f"PASS: Created premium plan with gig access: {data['plan']['id']}")
        # Store for cleanup
        TestAdminPlans.premium_plan_id = data["plan"]["id"]

    def test_plan_appears_in_admin_list(self, admin_headers):
        """Created plan should appear in admin list"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan created yet")
        r = requests.get(f"{BASE_URL}/api/plans/admin/all", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        plan_ids = [p["id"] for p in data["plans"]]
        assert TestAdminPlans.created_plan_id in plan_ids, "Created plan not found in admin list"
        print(f"PASS: Created plan appears in admin list")

    def test_active_plan_appears_in_public_list(self, admin_headers):
        """Active plan should appear in public /api/plans endpoint"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan created yet")
        r = requests.get(f"{BASE_URL}/api/plans")
        assert r.status_code == 200
        data = r.json()
        plan_ids = [p["id"] for p in data["plans"]]
        assert TestAdminPlans.created_plan_id in plan_ids, "Active plan not found in public list"
        print(f"PASS: Active plan appears in public list")

    def test_edit_plan_name_and_price(self, admin_headers):
        """PUT /api/plans/admin/{id} - update name and price"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan created yet")
        payload = {
            "name": "TEST_Basic Plan Updated",
            "price": 149.0
        }
        r = requests.put(f"{BASE_URL}/api/plans/admin/{TestAdminPlans.created_plan_id}", json=payload, headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["plan"]["name"] == "TEST_Basic Plan Updated"
        assert data["plan"]["price"] == 149.0
        print(f"PASS: Plan name and price updated successfully")

    def test_verify_plan_update_persisted(self, admin_headers):
        """Verify updated plan data persists in DB"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan created yet")
        r = requests.get(f"{BASE_URL}/api/plans/admin/all", headers=admin_headers)
        assert r.status_code == 200
        plans = r.json()["plans"]
        plan = next((p for p in plans if p["id"] == TestAdminPlans.created_plan_id), None)
        assert plan is not None, "Plan not found after update"
        assert plan["name"] == "TEST_Basic Plan Updated"
        assert plan["price"] == 149.0
        print(f"PASS: Plan update persisted in DB")

    def test_toggle_plan_inactive(self, admin_headers):
        """Toggle a plan to inactive via PUT"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan created yet")
        payload = {"is_active": False}
        r = requests.put(f"{BASE_URL}/api/plans/admin/{TestAdminPlans.created_plan_id}", json=payload, headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["plan"]["is_active"] is False
        print(f"PASS: Plan toggled to inactive")

    def test_inactive_plan_not_in_public_list(self):
        """Inactive plan should NOT appear in public /api/plans"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan created yet")
        r = requests.get(f"{BASE_URL}/api/plans")
        assert r.status_code == 200
        data = r.json()
        plan_ids = [p["id"] for p in data["plans"]]
        assert TestAdminPlans.created_plan_id not in plan_ids, "Inactive plan should not appear in public list"
        print(f"PASS: Inactive plan correctly excluded from public list")

    def test_inactive_plan_still_in_admin_list(self, admin_headers):
        """Inactive plan should still appear in admin /api/plans/admin/all"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan created yet")
        r = requests.get(f"{BASE_URL}/api/plans/admin/all", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        plan_ids = [p["id"] for p in data["plans"]]
        assert TestAdminPlans.created_plan_id in plan_ids, "Inactive plan should still be in admin list"
        print(f"PASS: Inactive plan appears in admin list")

    def test_admin_plan_has_user_count(self, admin_headers):
        """Admin plan list should include user_count field"""
        r = requests.get(f"{BASE_URL}/api/plans/admin/all", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for plan in data["plans"]:
            assert "user_count" in plan, f"Plan {plan.get('name')} missing user_count"
        print(f"PASS: All plans have user_count field")

    def test_delete_plan_with_zero_users(self, admin_headers):
        """DELETE /api/plans/admin/{id} - delete plan with 0 subscribers"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan created yet")
        r = requests.delete(f"{BASE_URL}/api/plans/admin/{TestAdminPlans.created_plan_id}", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "message" in data
        print(f"PASS: Plan deleted successfully: {data['message']}")

    def test_deleted_plan_not_in_admin_list(self, admin_headers):
        """Deleted plan should not appear in admin list"""
        if not TestAdminPlans.created_plan_id:
            pytest.skip("No plan ID to verify")
        r = requests.get(f"{BASE_URL}/api/plans/admin/all", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        plan_ids = [p["id"] for p in data["plans"]]
        assert TestAdminPlans.created_plan_id not in plan_ids, "Deleted plan still appears in admin list"
        print(f"PASS: Deleted plan not in admin list")

    def test_cleanup_premium_plan(self, admin_headers):
        """Cleanup: delete premium test plan if exists"""
        premium_id = getattr(TestAdminPlans, 'premium_plan_id', None)
        if not premium_id:
            return
        r = requests.delete(f"{BASE_URL}/api/plans/admin/{premium_id}", headers=admin_headers)
        print(f"Cleanup premium plan: {r.status_code}")


# ── Plan Feature Gating: GigBoard ─────────────────────────────────────────────

class TestGigBoardFeatureGating:
    """Test that GigBoard is gated by active_plan_features.public_gig_enabled"""

    def test_gig_board_blocked_without_plan(self, lead_headers):
        """User without active plan should get 403 on /api/public-gigs"""
        # Check user profile using auth/me endpoint
        profile_r = requests.get(f"{BASE_URL}/api/auth/me", headers=lead_headers)
        assert profile_r.status_code == 200
        user_data = profile_r.json()
        
        active_features = user_data.get("active_plan_features") or {}
        has_gig_access = active_features.get("public_gig_enabled", False)
        
        print(f"Lead user active_plan_features: {active_features}")
        
        # Try to browse gigs
        r = requests.get(f"{BASE_URL}/api/public-gigs", headers=lead_headers)
        if has_gig_access:
            # User has access - should succeed
            assert r.status_code == 200, f"User has access but got {r.status_code}"
            print(f"PASS: User with gig access can browse gigs (status {r.status_code})")
        else:
            # User has no access - should get 403
            assert r.status_code == 403, f"Expected 403 for user without gig access, got {r.status_code}: {r.text}"
            print(f"PASS: User without gig access correctly blocked with 403")

    def test_gig_board_blocked_without_auth(self):
        """Unauthenticated user should get 401 on /api/public-gigs"""
        r = requests.get(f"{BASE_URL}/api/public-gigs")
        assert r.status_code == 401, f"Expected 401 without auth, got {r.status_code}"
        print(f"PASS: GigBoard correctly requires authentication")


# ── Plan + User Integration: Subscribe & Gating ───────────────────────────────

class TestPlanUserIntegration:
    """Test creating a plan and verifying it's available for subscription"""
    gig_plan_id = None

    def test_create_active_gig_plan(self, admin_headers):
        """Create a plan with public_gig_enabled for subscription test"""
        payload = {
            "name": "TEST_Gig Access Plan",
            "price": 199.0,
            "description": "Test plan with gig board enabled",
            "features": {"public_gig_enabled": True, "whatsapp_enabled": False},
            "is_active": True,
            "sort_order": 101
        }
        r = requests.post(f"{BASE_URL}/api/plans/admin", json=payload, headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        TestPlanUserIntegration.gig_plan_id = data["plan"]["id"]
        print(f"PASS: Created gig-enabled plan: {TestPlanUserIntegration.gig_plan_id}")

    def test_plan_visible_in_public_endpoint(self):
        """New plan should be visible in public plans list"""
        if not TestPlanUserIntegration.gig_plan_id:
            pytest.skip("No plan created")
        r = requests.get(f"{BASE_URL}/api/plans")
        assert r.status_code == 200
        data = r.json()
        plan_ids = [p["id"] for p in data["plans"]]
        assert TestPlanUserIntegration.gig_plan_id in plan_ids
        # Verify features
        plan = next(p for p in data["plans"] if p["id"] == TestPlanUserIntegration.gig_plan_id)
        assert plan["features"]["public_gig_enabled"] is True
        print(f"PASS: Plan with gig access visible in public list")

    def test_cleanup_gig_plan(self, admin_headers):
        """Cleanup: delete test gig plan"""
        if not TestPlanUserIntegration.gig_plan_id:
            return
        r = requests.delete(f"{BASE_URL}/api/plans/admin/{TestPlanUserIntegration.gig_plan_id}", headers=admin_headers)
        print(f"Cleanup gig plan: {r.status_code}")


# ── Legacy Migration ──────────────────────────────────────────────────────────

class TestLegacyMigration:
    """Test legacy_tier migration feature"""
    legacy_plan_id = None

    def test_create_plan_with_legacy_tier(self, admin_headers):
        """Create plan with legacy_tier='base' should trigger auto-migration"""
        payload = {
            "name": "TEST_Legacy Base Plan",
            "price": 49.0,
            "description": "Legacy base migration test",
            "features": {"public_gig_enabled": False, "whatsapp_enabled": False},
            "legacy_tier": "base",
            "is_active": True,
            "sort_order": 102
        }
        r = requests.post(f"{BASE_URL}/api/plans/admin", json=payload, headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["plan"]["legacy_tier"] == "base"
        assert "migrated_users" in data
        TestLegacyMigration.legacy_plan_id = data["plan"]["id"]
        print(f"PASS: Plan with legacy_tier=base created. Migrated {data['migrated_users']} users")

    def test_manual_migrate_endpoint(self, admin_headers):
        """POST /api/plans/admin/{id}/migrate - manual trigger"""
        if not TestLegacyMigration.legacy_plan_id:
            pytest.skip("No legacy plan created")
        r = requests.post(
            f"{BASE_URL}/api/plans/admin/{TestLegacyMigration.legacy_plan_id}/migrate",
            headers=admin_headers
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "message" in data
        assert "migrated_count" in data
        print(f"PASS: Manual migration endpoint works. Message: {data['message']}")

    def test_migrate_plan_without_legacy_tier_fails(self, admin_headers):
        """Migrate endpoint should fail for plans without legacy_tier"""
        # Create a plan without legacy_tier first
        r = requests.post(f"{BASE_URL}/api/plans/admin", json={
            "name": "TEST_No Legacy Plan",
            "price": 59.0,
            "features": {"public_gig_enabled": False, "whatsapp_enabled": False},
            "is_active": True,
            "sort_order": 103
        }, headers=admin_headers)
        assert r.status_code == 200
        no_legacy_id = r.json()["plan"]["id"]

        # Try to migrate - should fail
        migrate_r = requests.post(
            f"{BASE_URL}/api/plans/admin/{no_legacy_id}/migrate",
            headers=admin_headers
        )
        assert migrate_r.status_code == 400, f"Expected 400, got {migrate_r.status_code}: {migrate_r.text}"
        print(f"PASS: Migrate endpoint correctly rejects plan without legacy_tier")

        # Cleanup
        requests.delete(f"{BASE_URL}/api/plans/admin/{no_legacy_id}", headers=admin_headers)

    def test_cleanup_legacy_plan(self, admin_headers):
        """Cleanup: delete legacy test plan"""
        if not TestLegacyMigration.legacy_plan_id:
            return
        r = requests.delete(f"{BASE_URL}/api/plans/admin/{TestLegacyMigration.legacy_plan_id}", headers=admin_headers)
        print(f"Cleanup legacy plan: {r.status_code}")


# ── Error Cases ───────────────────────────────────────────────────────────────

class TestPlanErrorCases:
    """Test error handling for plans"""

    def test_create_plan_non_admin_fails(self, lead_headers):
        """Non-admin user should not be able to create plans"""
        payload = {
            "name": "TEST_Unauthorized Plan",
            "price": 99.0,
            "features": {"public_gig_enabled": False, "whatsapp_enabled": False},
            "is_active": True
        }
        r = requests.post(f"{BASE_URL}/api/plans/admin", json=payload, headers=lead_headers)
        assert r.status_code in [401, 403], f"Expected 401/403, got {r.status_code}: {r.text}"
        print(f"PASS: Non-admin correctly blocked from creating plans ({r.status_code})")

    def test_delete_nonexistent_plan(self, admin_headers):
        """Delete non-existent plan should return 404"""
        r = requests.delete(f"{BASE_URL}/api/plans/admin/nonexistent-id-123", headers=admin_headers)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
        print(f"PASS: Delete nonexistent plan returns 404")

    def test_update_nonexistent_plan(self, admin_headers):
        """Update non-existent plan should return 404"""
        r = requests.put(f"{BASE_URL}/api/plans/admin/nonexistent-id-123", json={"name": "Test"}, headers=admin_headers)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
        print(f"PASS: Update nonexistent plan returns 404")
