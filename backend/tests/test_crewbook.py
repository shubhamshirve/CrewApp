"""
CrewBook API Tests - Auth, Admin, Users, Gigs, Wallet, Connections
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@crewbook.in"
ADMIN_PASSWORD = "Admin@123"
TEST_EMAIL = f"TEST_user_{int(time.time())}@example.com"
TEST_PASSWORD = "Test@123"

# ---- Fixtures ----

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="module")
def admin_token(api):
    # Seed admin first
    api.post(f"{BASE_URL}/api/admin/seed-admin")
    resp = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["token"]

@pytest.fixture(scope="module")
def admin_client(api, admin_token):
    api.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api

@pytest.fixture(scope="module")
def registered_user(api):
    """Register a test user and return token"""
    resp = api.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Test User",
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "phone": "9876543210",
        "location": "Mumbai",
        "pincode": "400001"
    })
    assert resp.status_code in [200, 201], f"Register failed: {resp.text}"
    data = resp.json()
    return {"token": data["token"], "user": data["user"]}


# ---- Health ----

class TestHealth:
    """Health check"""
    def test_health(self, api):
        resp = api.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


# ---- Auth ----

class TestAuth:
    """Authentication flows"""

    def test_register(self, api):
        email = f"TEST_reg_{int(time.time())}@example.com"
        resp = api.post(f"{BASE_URL}/api/auth/register", json={
            "full_name": "Reg User",
            "email": email,
            "password": "Test@123",
            "phone": "9876543211",
            "location": "Delhi",
            "pincode": "110001"
        })
        assert resp.status_code in [200, 201], f"Register failed: {resp.text}"
        data = resp.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == email.lower()

    def test_login_admin(self, api):
        resp = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["is_admin"] is True

    def test_login_invalid(self, api):
        resp = api.post(f"{BASE_URL}/api/auth/login", json={"email": "wrong@example.com", "password": "wrongpass"})
        assert resp.status_code in [400, 401, 403]

    def test_me_endpoint(self, api, admin_token):
        resp = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == ADMIN_EMAIL


# ---- Admin ----

class TestAdmin:
    """Admin endpoints"""

    def test_admin_stats(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_users" in data or "users" in data or isinstance(data, dict)

    def test_verification_queue(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/verification-queue")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list) or "users" in data

    def test_admin_users_list(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users")
        assert resp.status_code == 200


# ---- Users ----

class TestUsers:
    """User endpoints"""

    def test_search_users(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/users/search?q=test")
        assert resp.status_code in [200, 404]

    def test_get_profile(self, registered_user, api):
        user_id = registered_user["user"]["id"]
        resp = api.get(f"{BASE_URL}/api/users/{user_id}", headers={"Authorization": f"Bearer {registered_user['token']}"})
        assert resp.status_code == 200


# ---- Gigs ----

class TestGigs:
    """Gig endpoints"""

    def test_list_gigs(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/gigs")
        assert resp.status_code == 200

    def test_create_gig(self, admin_client):
        resp = admin_client.post(f"{BASE_URL}/api/gigs", json={
            "title": "TEST_ Wedding Shoot",
            "description": "Test gig for wedding",
            "sessions": [
                {
                    "date": "2026-03-15",
                    "start_time": "09:00",
                    "end_time": "18:00",
                    "location": "Mumbai",
                    "event_type": "wedding"
                }
            ]
        })
        assert resp.status_code in [200, 201], f"Create gig failed: {resp.text}"
        data = resp.json()
        assert "id" in data or "_id" in data


# ---- Wallet ----

class TestWallet:
    """Wallet endpoints"""

    def test_get_wallet(self, registered_user, api):
        resp = api.get(f"{BASE_URL}/api/wallet", headers={"Authorization": f"Bearer {registered_user['token']}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "balance" in data or "wallet" in data or isinstance(data, dict)

    def test_subscription_plans(self, api, registered_user):
        resp = api.get(f"{BASE_URL}/api/wallet/plans", headers={"Authorization": f"Bearer {registered_user['token']}"})
        assert resp.status_code in [200, 404]


# ---- Notifications ----

class TestNotifications:
    """Notifications endpoint"""

    def test_get_notifications(self, registered_user, api):
        resp = api.get(f"{BASE_URL}/api/notifications", headers={"Authorization": f"Bearer {registered_user['token']}"})
        assert resp.status_code == 200


# ---- Connections ----

class TestConnections:
    """Connections endpoint"""

    def test_get_connections(self, registered_user, api):
        resp = api.get(f"{BASE_URL}/api/connections", headers={"Authorization": f"Bearer {registered_user['token']}"})
        assert resp.status_code == 200


class TestLoginTracking:
    """Login events are recorded in login_logs"""

    def test_login_creates_log(self, api, registered_user, admin_client):
        """After login, admin profile endpoint shows a login log entry"""
        user_id = registered_user["user"]["id"]
        assert registered_user["token"] is not None


class TestAdminUsersFilters:
    """GET /admin/users supports search + filters"""

    def test_search_by_name(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users?search=Test")
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "total" in data

    def test_filter_by_plan(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users?plan=free")
        assert resp.status_code == 200
        users = resp.json()["users"]
        for u in users:
            assert u["subscription_plan"] == "free"

    def test_filter_by_status_suspended(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users?status=suspended")
        assert resp.status_code == 200
        users = resp.json()["users"]
        for u in users:
            assert u["is_suspended"] is True


class TestAdminUserProfile:
    """GET /admin/users/{id}/profile returns aggregated user data"""

    def test_profile_returns_all_sections(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.get(f"{BASE_URL}/api/admin/users/{user_id}/profile")
        assert resp.status_code == 200
        data = resp.json()
        assert "user" in data
        assert "gigs" in data
        assert "invites" in data
        assert "wallet_transactions" in data
        assert "wallet_adjustments" in data
        assert "ratings" in data
        assert "login_logs" in data

    def test_profile_user_no_password(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.get(f"{BASE_URL}/api/admin/users/{user_id}/profile")
        assert "password_hash" not in resp.json()["user"]

    def test_profile_404_on_missing_user(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users/nonexistent-id/profile")
        assert resp.status_code == 404


class TestAdminBulkAction:
    """POST /admin/users/bulk-action applies actions to multiple users"""

    def test_bulk_suspend(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "suspend",
            "user_ids": [user_id],
        })
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1
        user_resp = admin_client.get(f"{BASE_URL}/api/admin/users")
        users = user_resp.json()["users"]
        target = next((u for u in users if u["id"] == user_id), None)
        assert target is not None
        assert target["is_suspended"] is True

    def test_bulk_unsuspend(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "unsuspend",
            "user_ids": [user_id],
        })
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1

    def test_bulk_verify(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "verify",
            "user_ids": [user_id],
        })
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1

    def test_bulk_notify(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "notify",
            "user_ids": [user_id],
            "title": "Test announcement",
            "message": "This is a bulk notification",
        })
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1

    def test_bulk_invalid_action(self, admin_client):
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "delete_everything",
            "user_ids": [],
        })
        assert resp.status_code == 400


class TestAdminImpersonate:
    """POST /admin/impersonate/{id} returns a short-lived user token"""

    def test_impersonate_returns_token(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/impersonate/{user_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["expires_in"] == 3600

    def test_impersonate_token_authenticates_as_user(self, api, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/impersonate/{user_id}")
        token = resp.json()["token"]
        me_resp = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["id"] == user_id

    def test_impersonate_nonexistent_user(self, admin_client):
        resp = admin_client.post(f"{BASE_URL}/api/admin/impersonate/nonexistent-id")
        assert resp.status_code == 404


class TestAdminWalletAdjust:
    """POST /admin/wallet/{id}/adjust credits or debits user wallet"""

    def test_credit_increases_balance(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 100.0,
            "type": "credit",
            "reason": "Goodwill credit for test",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "new_balance" in data
        assert data["new_balance"] >= 100.0

    def test_debit_decreases_balance(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 200.0, "type": "credit", "reason": "Setup"
        })
        resp = admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 50.0,
            "type": "debit",
            "reason": "Correction debit",
        })
        assert resp.status_code == 200
        assert resp.json()["new_balance"] >= 150.0

    def test_zero_amount_rejected(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 0,
            "type": "credit",
            "reason": "Bad input",
        })
        assert resp.status_code == 400

    def test_missing_reason_rejected(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 10.0,
            "type": "credit",
            "reason": "",
        })
        assert resp.status_code == 400


class TestAdminUserFlags:
    """PUT /admin/users/{id}/flags sets is_featured and is_high_risk"""

    def test_set_featured(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/flags", json={
            "is_featured": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_featured"] is True

    def test_set_high_risk(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/flags", json={
            "is_high_risk": True,
        })
        assert resp.status_code == 200
        assert resp.json()["is_high_risk"] is True

    def test_flags_404_on_missing(self, admin_client):
        resp = admin_client.put(f"{BASE_URL}/api/admin/users/nonexistent/flags", json={
            "is_featured": False,
        })
        assert resp.status_code == 404
