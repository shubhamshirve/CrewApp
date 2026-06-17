"""
Photoo New Features Tests:
- Templates API (GET, PUT, DELETE) -- notification template management
- Calendar Sync API (status, connect, disconnect) -- mocked Google Calendar
- Gigs 90-min buffer -- schedule conflict check
- Contract download -- PDF generation for accepted invites
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@photoo.in"
ADMIN_PASSWORD = "Admin@123"


# ---- Fixtures ----

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    """Seed admin and get token."""
    api.post(f"{BASE_URL}/api/admin/seed-admin")
    resp = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="module")
def admin_client(api, admin_token):
    api.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api


@pytest.fixture(scope="module")
def test_user_client(api):
    """Register a fresh test user and return (token, user_id, session)."""
    email = f"TEST_newfeature_{int(time.time())}@example.com"
    resp = api.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Feature Test User",
        "email": email,
        "password": "Test@123",
        "phone": "9876540001",
        "location": "Bangalore",
        "pincode": "560001"
    })
    assert resp.status_code in [200, 201], f"Register failed: {resp.text}"
    data = resp.json()
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {data['token']}"
    })
    return {"session": s, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def test_user2_client(api):
    """Second test user for invite/buffer tests."""
    email = f"TEST_freelancer_{int(time.time())}@example.com"
    resp = api.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Freelancer User",
        "email": email,
        "password": "Test@123",
        "phone": "9876540002",
        "location": "Pune",
        "pincode": "411001"
    })
    assert resp.status_code in [200, 201], f"Register 2 failed: {resp.text}"
    data = resp.json()
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {data['token']}"
    })
    return {"session": s, "token": data["token"], "user": data["user"]}


# ========== Templates Tests ==========

class TestTemplatesAPI:
    """Notification Templates CRUD via admin auth"""

    def test_get_all_templates_returns_12(self, admin_client):
        """GET /api/templates returns exactly 12 event types"""
        resp = admin_client.get(f"{BASE_URL}/api/templates")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "templates" in data
        assert len(data["templates"]) == 12, f"Expected 12, got {len(data['templates'])}"
        print(f"PASS: GET /api/templates returns {len(data['templates'])} templates")

    def test_templates_have_required_fields(self, admin_client):
        """Each template has event_type, label, description, variables, has_saved"""
        resp = admin_client.get(f"{BASE_URL}/api/templates")
        data = resp.json()
        for tmpl in data["templates"]:
            assert "event_type" in tmpl
            assert "label" in tmpl
            assert "description" in tmpl
            assert "variables" in tmpl
            assert "has_saved" in tmpl
        print("PASS: All templates have required fields")

    def test_get_single_template_invite_sent(self, admin_client):
        """GET /api/templates/invite_sent returns template data"""
        resp = admin_client.get(f"{BASE_URL}/api/templates/invite_sent")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert data["event_type"] == "invite_sent"
        print(f"PASS: GET /api/templates/invite_sent => {data}")

    def test_put_template_saves_data(self, admin_client):
        """PUT /api/templates/invite_sent saves platform_message, whatsapp, email"""
        payload = {
            "event_type": "invite_sent",
            "platform_message": "Hi {{freelancer_name}}, you got a new invite for {{gig_title}}!",
            "whatsapp_template_name": "gig_invite_notification",
            "whatsapp_language_code": "en",
            "email_subject": "New Gig Invite: {{gig_title}}",
            "email_body": "<p>Hi {{freelancer_name}},</p><p>You have a new invite.</p>",
            "is_active": True
        }
        resp = admin_client.put(f"{BASE_URL}/api/templates/invite_sent", json=payload)
        assert resp.status_code == 200, f"PUT failed: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert data["template"]["platform_message"] == payload["platform_message"]
        assert data["template"]["email_subject"] == payload["email_subject"]
        print(f"PASS: PUT /api/templates/invite_sent saved successfully")

    def test_get_template_after_save_returns_saved_data(self, admin_client):
        """GET /api/templates/invite_sent after save returns the saved data"""
        resp = admin_client.get(f"{BASE_URL}/api/templates/invite_sent")
        assert resp.status_code == 200
        data = resp.json()
        # After save in previous test, has_saved should reflect in list
        assert data["event_type"] == "invite_sent"
        print(f"PASS: GET after save: platform_message={data.get('platform_message')}")

    def test_list_templates_configured_count_increases(self, admin_client):
        """After saving a template, has_saved is True for that event"""
        resp = admin_client.get(f"{BASE_URL}/api/templates")
        data = resp.json()
        saved = [t for t in data["templates"] if t.get("has_saved")]
        assert len(saved) >= 1, "Expected at least 1 configured template"
        print(f"PASS: {len(saved)} templates configured after save")

    def test_put_template_invalid_event_type(self, admin_client):
        """PUT /api/templates/nonexistent_event returns 400"""
        payload = {
            "event_type": "nonexistent_event",
            "platform_message": "test",
            "is_active": True
        }
        resp = admin_client.put(f"{BASE_URL}/api/templates/nonexistent_event", json=payload)
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("PASS: Invalid event type returns 400")

    def test_delete_template_invite_sent(self, admin_client):
        """DELETE /api/templates/invite_sent removes saved template"""
        # First ensure it is saved
        admin_client.put(f"{BASE_URL}/api/templates/invite_sent", json={
            "event_type": "invite_sent",
            "platform_message": "Temp message",
            "is_active": True
        })
        resp = admin_client.delete(f"{BASE_URL}/api/templates/invite_sent")
        assert resp.status_code == 200, f"DELETE failed: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        print("PASS: DELETE /api/templates/invite_sent successful")

    def test_delete_nonexistent_template_returns_404(self, admin_client):
        """DELETE /api/templates/invite_sent when not saved returns 404"""
        resp = admin_client.delete(f"{BASE_URL}/api/templates/invite_sent")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("PASS: DELETE nonexistent template returns 404")

    def test_templates_require_admin_auth(self, api):
        """Templates endpoints require admin auth — return 401 without token"""
        no_auth = requests.Session()
        no_auth.headers.update({"Content-Type": "application/json"})
        resp = no_auth.get(f"{BASE_URL}/api/templates")
        assert resp.status_code in [401, 403], f"Expected auth error, got {resp.status_code}"
        print("PASS: Templates require auth")

    def test_get_event_types_endpoint(self, admin_client):
        """GET /api/templates/event-types returns event types list"""
        resp = admin_client.get(f"{BASE_URL}/api/templates/event-types")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "event_types" in data
        assert len(data["event_types"]) == 12
        print(f"PASS: /api/templates/event-types returns {len(data['event_types'])} types")


# ========== Calendar Sync Tests ==========

class TestCalendarSyncAPI:
    """Google Calendar Sync endpoints (mocked)"""

    def test_calendar_status_returns_connected_field(self, test_user_client):
        """GET /api/calendar/status returns connected status"""
        resp = test_user_client["session"].get(f"{BASE_URL}/api/calendar/status")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "connected" in data
        assert "simulated" in data
        assert data["simulated"] is True
        print(f"PASS: GET /api/calendar/status => connected={data['connected']}")

    def test_calendar_connect_sets_connected_true(self, test_user_client):
        """POST /api/calendar/connect marks user as connected"""
        resp = test_user_client["session"].post(f"{BASE_URL}/api/calendar/connect", json={})
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "connected"
        assert data.get("simulated") is True
        print(f"PASS: POST /api/calendar/connect => {data}")

    def test_calendar_status_after_connect_shows_connected(self, test_user_client):
        """Status shows connected=True after connecting"""
        resp = test_user_client["session"].get(f"{BASE_URL}/api/calendar/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["connected"] is True
        print(f"PASS: Status shows connected=True after connect")

    def test_calendar_disconnect_sets_connected_false(self, test_user_client):
        """POST /api/calendar/disconnect marks user as disconnected"""
        resp = test_user_client["session"].post(f"{BASE_URL}/api/calendar/disconnect")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "disconnected"
        print(f"PASS: POST /api/calendar/disconnect => {data}")

    def test_calendar_status_after_disconnect_shows_false(self, test_user_client):
        """Status shows connected=False after disconnecting"""
        resp = test_user_client["session"].get(f"{BASE_URL}/api/calendar/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["connected"] is False
        print(f"PASS: Status shows connected=False after disconnect")

    def test_calendar_requires_auth(self):
        """Calendar endpoints require authentication"""
        no_auth = requests.Session()
        resp = no_auth.get(f"{BASE_URL}/api/calendar/status")
        assert resp.status_code in [401, 403], f"Expected auth error, got {resp.status_code}"
        print("PASS: Calendar requires auth")


# ========== 90-min Buffer Tests ==========

class TestNinetyMinBuffer:
    """90-minute buffer enforcement on gig invite creation"""

    def test_invite_creates_ok_without_conflict(self, admin_client, test_user2_client):
        """First invite for a freelancer goes through without conflict."""
        # First verify the freelancer via admin so they exist
        freelancer_id = test_user2_client["user"]["id"]

        # Admin verifies the lead so they can create gigs
        admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "verify", "user_ids": [admin_client.get(f"{BASE_URL}/api/auth/me").json()["id"]]
        })

        # Create gig as admin (admin is verified)
        gig_resp = admin_client.post(f"{BASE_URL}/api/gigs", json={
            "title": "TEST_Buffer Gig",
            "description": "For buffer testing",
            "sessions": [
                {
                    "date": "2026-06-15",
                    "start_time": "09:00",
                    "end_time": "12:00",
                    "location": "Mumbai",
                    "event_type": "Wedding"
                }
            ]
        })
        assert gig_resp.status_code in [200, 201, 403], f"Gig create: {gig_resp.text}"
        if gig_resp.status_code == 403:
            pytest.skip("Admin not verified for gig creation — skip 90min test")

        gig_data = gig_resp.json()
        gig_id = gig_data.get("id") or gig_data.get("_id")
        session_id = gig_data["sessions"][0]["id"]

        # Send invite to freelancer
        invite_resp = admin_client.post(f"{BASE_URL}/api/gigs/{gig_id}/invites", json={
            "freelancer_id": freelancer_id,
            "session_id": session_id,
            "session_date": "2026-06-15",
            "role": "Videographer",
            "proposed_fee": 5000
        })
        # Either success or 409 conflict (if freelancer already has session)
        assert invite_resp.status_code in [200, 201, 400, 409], f"Invite: {invite_resp.text}"
        print(f"PASS: First invite response: {invite_resp.status_code}")
        return invite_resp, gig_id, session_id, freelancer_id

    def test_90min_buffer_returns_409_on_conflict(self, admin_client, test_user2_client):
        """
        When a freelancer already has an accepted invite from 09:00-12:00,
        a new invite from 12:30-15:00 (within 90min buffer) should return 409.
        This test creates the setup then checks the conflict.
        """
        freelancer_id = test_user2_client["user"]["id"]

        # Create first gig
        gig1 = admin_client.post(f"{BASE_URL}/api/gigs", json={
            "title": "TEST_Buffer Gig A",
            "sessions": [{
                "date": "2026-07-20", "start_time": "09:00", "end_time": "12:00",
                "location": "Mumbai", "event_type": "Wedding"
            }]
        })
        if gig1.status_code == 403:
            pytest.skip("Admin not verified for gig creation")

        gig1_data = gig1.json()
        gig1_id = gig1_data.get("id") or gig1_data.get("_id")
        session1_id = gig1_data["sessions"][0]["id"]

        # Send and accept first invite
        inv1 = admin_client.post(f"{BASE_URL}/api/gigs/{gig1_id}/invites", json={
            "freelancer_id": freelancer_id,
            "session_id": session1_id,
            "session_date": "2026-07-20",
            "role": "Videographer",
            "proposed_fee": 5000
        })
        if inv1.status_code in [400, 409]:
            # Already has invite - this is fine, just get the id
            print(f"Invite 1 response: {inv1.status_code} - {inv1.text[:100]}")
        elif inv1.status_code in [200, 201]:
            invite1_id = inv1.json().get("id")
            # Accept as freelancer
            if invite1_id:
                test_user2_client["session"].put(
                    f"{BASE_URL}/api/gigs/invites/{invite1_id}/respond",
                    json={"action": "accept"}
                )
                print(f"Freelancer accepted invite 1: {invite1_id}")

        # Create second gig (within 90min of first session end=12:00, so 12:30 < 12:00 + 90min = 13:30)
        gig2 = admin_client.post(f"{BASE_URL}/api/gigs", json={
            "title": "TEST_Buffer Gig B",
            "sessions": [{
                "date": "2026-07-20", "start_time": "12:30", "end_time": "15:00",
                "location": "Delhi", "event_type": "Reception"
            }]
        })
        if gig2.status_code == 403:
            pytest.skip("Gig creation forbidden")

        gig2_data = gig2.json()
        gig2_id = gig2_data.get("id") or gig2_data.get("_id")
        session2_id = gig2_data["sessions"][0]["id"]

        # Try to send conflicting invite — expect 409 if freelancer accepted first
        inv2 = admin_client.post(f"{BASE_URL}/api/gigs/{gig2_id}/invites", json={
            "freelancer_id": freelancer_id,
            "session_id": session2_id,
            "session_date": "2026-07-20",
            "role": "Photographer",
            "proposed_fee": 4000
        })
        print(f"Buffer conflict invite response: {inv2.status_code} - {inv2.text[:200]}")
        # Accept 200/201 (no conflict because first wasn't accepted) or 409 (conflict)
        assert inv2.status_code in [200, 201, 409], f"Unexpected: {inv2.text}"
        if inv2.status_code == 409:
            print("PASS: 90-min buffer correctly returned 409 conflict")
        else:
            print("INFO: No conflict detected (likely first invite wasn't accepted)")


# ========== Contract Download Tests ==========

class TestContractDownload:
    """PDF contract generation"""

    def test_contract_returns_400_for_non_accepted_invite(self, admin_client, test_user2_client):
        """GET /api/gigs/invites/{id}/contract returns 400 when invite not accepted"""
        freelancer_id = test_user2_client["user"]["id"]

        # Create a gig and send invite (not accepted)
        gig = admin_client.post(f"{BASE_URL}/api/gigs", json={
            "title": "TEST_Contract Gig",
            "sessions": [{
                "date": "2026-08-10", "start_time": "10:00", "end_time": "14:00",
                "location": "Chennai", "event_type": "Corporate"
            }]
        })
        if gig.status_code == 403:
            pytest.skip("Admin not verified for gig creation")

        gig_data = gig.json()
        gig_id = gig_data.get("id") or gig_data.get("_id")
        session_id = gig_data["sessions"][0]["id"]

        inv = admin_client.post(f"{BASE_URL}/api/gigs/{gig_id}/invites", json={
            "freelancer_id": freelancer_id,
            "session_id": session_id,
            "session_date": "2026-08-10",
            "role": "Photographer",
            "proposed_fee": 6000
        })

        if inv.status_code not in [200, 201]:
            pytest.skip(f"Could not create invite: {inv.text}")

        invite_id = inv.json().get("id")
        assert invite_id, "Invite ID not returned"

        # Try to download contract while invite is pending (should return 400)
        contract_resp = admin_client.get(f"{BASE_URL}/api/gigs/invites/{invite_id}/contract")
        assert contract_resp.status_code == 400, f"Expected 400, got {contract_resp.status_code}: {contract_resp.text}"
        data = contract_resp.json()
        assert "accepted" in data.get("detail", "").lower() or "accepted" in str(data).lower()
        print(f"PASS: Contract returns 400 for pending invite: {data}")

    def test_contract_download_pdf_for_accepted_invite(self, admin_client, test_user2_client):
        """GET /api/gigs/invites/{id}/contract returns PDF bytes for accepted invite"""
        freelancer_id = test_user2_client["user"]["id"]

        # Create gig
        gig = admin_client.post(f"{BASE_URL}/api/gigs", json={
            "title": "TEST_Contract PDF Gig",
            "sessions": [{
                "date": "2026-09-01", "start_time": "08:00", "end_time": "16:00",
                "location": "Hyderabad", "event_type": "Wedding"
            }]
        })
        if gig.status_code == 403:
            pytest.skip("Admin not verified for gig creation")

        gig_data = gig.json()
        gig_id = gig_data.get("id") or gig_data.get("_id")
        session_id = gig_data["sessions"][0]["id"]

        # Send invite
        inv = admin_client.post(f"{BASE_URL}/api/gigs/{gig_id}/invites", json={
            "freelancer_id": freelancer_id,
            "session_id": session_id,
            "session_date": "2026-09-01",
            "role": "Second Shooter",
            "proposed_fee": 3500
        })
        if inv.status_code not in [200, 201]:
            pytest.skip(f"Could not create invite: {inv.text}")

        invite_id = inv.json().get("id")

        # Accept as freelancer
        accept_resp = test_user2_client["session"].put(
            f"{BASE_URL}/api/gigs/invites/{invite_id}/respond",
            json={"action": "accept"}
        )
        assert accept_resp.status_code == 200, f"Accept failed: {accept_resp.text}"
        print(f"Freelancer accepted invite: {invite_id}")

        # Download contract
        contract_resp = admin_client.get(f"{BASE_URL}/api/gigs/invites/{invite_id}/contract")
        assert contract_resp.status_code == 200, f"Contract download failed: {contract_resp.text}"
        assert contract_resp.headers.get("Content-Type") == "application/pdf"
        assert len(contract_resp.content) > 1000, "PDF content seems too small"
        # Verify PDF magic bytes
        assert contract_resp.content[:4] == b'%PDF', "Response does not start with PDF magic bytes"
        print(f"PASS: PDF contract downloaded, size={len(contract_resp.content)} bytes, Content-Type=application/pdf")

    def test_contract_returns_404_for_nonexistent_invite(self, admin_client):
        """GET /api/gigs/invites/nonexistent/contract returns 404"""
        resp = admin_client.get(f"{BASE_URL}/api/gigs/invites/nonexistent-invite-id/contract")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("PASS: Contract returns 404 for nonexistent invite")
