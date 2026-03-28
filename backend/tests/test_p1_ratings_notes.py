"""
CrewBook P1 Features Tests:
- GET /api/ratings/pending - returns pending ratings for completed gigs
- POST /api/ratings - submit rating (punctuality, gear_handling, teamwork)
- GET /api/notes/{freelancer_id} - get private note (empty if none)
- PUT /api/notes/{freelancer_id} - save/update private note
- DELETE /api/notes/{freelancer_id} - delete private note (404 if not found)
- Privacy: notes are only visible to the author (lead_id = current user JWT)
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@crewbook.in"
ADMIN_PASSWORD = "Admin@123"

LEAD_EMAIL = "testlead@example.com"
LEAD_PASSWORD = "Test@123"
FREELANCER_EMAIL = "testfreelancer@example.com"
FREELANCER_PASSWORD = "Test@123"


# ── Shared test state ──────────────────────────────────────────────────────────
_state = {}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_client(api):
    """Seed admin and get token."""
    api.post(f"{BASE_URL}/api/admin/seed-admin")
    resp = api.post(f"{BASE_URL}/api/auth/login",
                    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {resp.json()['token']}"
    })
    return s


@pytest.fixture(scope="module")
def lead_client(api, admin_client):
    """Login as lead; register if needed; ensure verified via admin."""
    # Try login first
    resp = api.post(f"{BASE_URL}/api/auth/login",
                    json={"email": LEAD_EMAIL, "password": LEAD_PASSWORD})
    if resp.status_code != 200:
        # Register lead
        reg = api.post(f"{BASE_URL}/api/auth/register", json={
            "full_name": "Test Lead Photographer",
            "email": LEAD_EMAIL,
            "password": LEAD_PASSWORD,
            "phone": "9876500001",
            "location": "Mumbai",
            "pincode": "400001"
        })
        assert reg.status_code in [200, 201], f"Lead register failed: {reg.text}"
        token = reg.json()["token"]
        user = reg.json()["user"]
    else:
        token = resp.json()["token"]
        user = resp.json()["user"]

    # Ensure verified (admin bulk verify)
    if not user.get("is_verified"):
        admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action",
                         json={"user_ids": [user["id"]], "action": "verify"})
        # Re-login to get fresh token with updated user state
        resp2 = api.post(f"{BASE_URL}/api/auth/login",
                         json={"email": LEAD_EMAIL, "password": LEAD_PASSWORD})
        if resp2.status_code == 200:
            token = resp2.json()["token"]
            user = resp2.json()["user"]

    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    })
    return {"session": s, "token": token, "user": user}


@pytest.fixture(scope="module")
def freelancer_client(api, admin_client):
    """Login as freelancer; register if needed; ensure verified."""
    resp = api.post(f"{BASE_URL}/api/auth/login",
                    json={"email": FREELANCER_EMAIL, "password": FREELANCER_PASSWORD})
    if resp.status_code != 200:
        reg = api.post(f"{BASE_URL}/api/auth/register", json={
            "full_name": "Test Freelancer",
            "email": FREELANCER_EMAIL,
            "password": FREELANCER_PASSWORD,
            "phone": "9876500002",
            "location": "Pune",
            "pincode": "411001"
        })
        assert reg.status_code in [200, 201], f"Freelancer register failed: {reg.text}"
        token = reg.json()["token"]
        user = reg.json()["user"]
    else:
        token = resp.json()["token"]
        user = resp.json()["user"]

    # Ensure verified
    if not user.get("is_verified"):
        admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action",
                         json={"user_ids": [user["id"]], "action": "verify"})
        resp2 = api.post(f"{BASE_URL}/api/auth/login",
                         json={"email": FREELANCER_EMAIL, "password": FREELANCER_PASSWORD})
        if resp2.status_code == 200:
            token = resp2.json()["token"]
            user = resp2.json()["user"]

    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    })
    return {"session": s, "token": token, "user": user}


# ── Helper: Setup completed gig ───────────────────────────────────────────────

@pytest.fixture(scope="module")
def completed_gig(lead_client, freelancer_client, admin_client):
    """
    Full flow: Lead creates gig → invites freelancer → freelancer accepts →
    freelancer marks handover → gig becomes 'completed'.
    Returns (gig_id, invite_id, freelancer_id, lead_session).
    """
    lead_s = lead_client["session"]
    free_s = freelancer_client["session"]
    freelancer_id = freelancer_client["user"]["id"]

    # 1. Create gig as lead
    gig_payload = {
        "title": "TEST_P1 Rating Flow Gig",
        "description": "Gig for testing P1 rating flow",
        "sessions": [{
            "date": "2025-12-15",
            "start_time": "10:00",
            "end_time": "18:00",
            "location": "Mumbai Studio",
            "venue_name": "Test Venue",
            "event_type": "Wedding"
        }]
    }
    gig_resp = lead_s.post(f"{BASE_URL}/api/gigs", json=gig_payload)
    assert gig_resp.status_code in [200, 201], f"Create gig failed: {gig_resp.text}"
    gig = gig_resp.json()
    gig_id = gig["id"]
    session_id = gig["sessions"][0]["id"]

    # 2. Invite freelancer
    invite_payload = {
        "freelancer_id": freelancer_id,
        "session_id": session_id,
        "session_date": "2025-12-15",
        "role": "Cinematographer",
        "proposed_fee": 5000.0,
        "notes": "Please bring your camera"
    }
    inv_resp = lead_s.post(f"{BASE_URL}/api/gigs/{gig_id}/invites", json=invite_payload)
    assert inv_resp.status_code in [200, 201], f"Send invite failed: {inv_resp.text}"
    # Get invite ID from gig detail
    gig_detail = lead_s.get(f"{BASE_URL}/api/gigs/{gig_id}")
    invites = gig_detail.json().get("invites", [])
    invite_id = invites[0]["id"] if invites else None
    assert invite_id, "No invite found in gig"

    # 3. Freelancer accepts invite
    accept_resp = free_s.put(f"{BASE_URL}/api/gigs/invites/{invite_id}/respond",
                             json={"action": "accept"})
    assert accept_resp.status_code == 200, f"Accept invite failed: {accept_resp.text}"

    # 4. Freelancer marks handover (data delivered) -> gig becomes 'completed'
    handover_resp = free_s.put(f"{BASE_URL}/api/gigs/{gig_id}/handover")
    assert handover_resp.status_code == 200, f"Handover failed: {handover_resp.text}"

    # Verify gig status is now completed
    gig_check = lead_s.get(f"{BASE_URL}/api/gigs/{gig_id}")
    assert gig_check.status_code == 200
    assert gig_check.json()["status"] == "completed", f"Gig status not completed: {gig_check.json()['status']}"

    return {
        "gig_id": gig_id,
        "invite_id": invite_id,
        "freelancer_id": freelancer_id,
        "lead_id": lead_client["user"]["id"],
    }


# ══════════════════════════════════════════════════════════════════════════════
# RATINGS TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestPendingRatings:
    """GET /api/ratings/pending — returns pending ratings for completed gigs"""

    def test_get_pending_ratings_unauthenticated(self, api):
        """Should return 401 without auth token."""
        resp = api.get(f"{BASE_URL}/api/ratings/pending")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_get_pending_ratings_as_lead(self, lead_client, completed_gig):
        """Lead should see the completed gig in pending ratings."""
        s = lead_client["session"]
        resp = s.get(f"{BASE_URL}/api/ratings/pending")
        assert resp.status_code == 200, f"Pending ratings failed: {resp.text}"

        data = resp.json()
        assert isinstance(data, list), "Should return a list"

        # Find our test gig
        gig_id = completed_gig["gig_id"]
        freelancer_id = completed_gig["freelancer_id"]
        matching = [r for r in data if r["gig"]["id"] == gig_id]
        assert len(matching) > 0, f"Completed gig {gig_id} not found in pending ratings. Got: {[r['gig']['id'] for r in data]}"

        item = matching[0]
        assert "gig" in item, "Item should have 'gig' key"
        assert "users_to_rate" in item, "Item should have 'users_to_rate' key"
        assert isinstance(item["users_to_rate"], list), "users_to_rate should be list"
        assert len(item["users_to_rate"]) > 0, "Should have users to rate"

        # Validate user structure
        user_to_rate = item["users_to_rate"][0]
        assert "user_id" in user_to_rate, "user_to_rate should have user_id"
        assert "full_name" in user_to_rate, "user_to_rate should have full_name"
        assert user_to_rate["user_id"] == freelancer_id, f"Expected freelancer {freelancer_id}, got {user_to_rate['user_id']}"

    def test_get_pending_ratings_as_freelancer(self, freelancer_client, completed_gig):
        """Freelancer should see the completed gig (to rate lead) in pending ratings."""
        s = freelancer_client["session"]
        resp = s.get(f"{BASE_URL}/api/ratings/pending")
        assert resp.status_code == 200, f"Pending ratings failed: {resp.text}"

        data = resp.json()
        assert isinstance(data, list)

        gig_id = completed_gig["gig_id"]
        lead_id = completed_gig["lead_id"]
        matching = [r for r in data if r["gig"]["id"] == gig_id]
        assert len(matching) > 0, f"Gig {gig_id} not found in freelancer pending ratings"

        users = matching[0]["users_to_rate"]
        assert len(users) > 0
        assert users[0]["user_id"] == lead_id, f"Expected lead {lead_id} to be rated by freelancer"


class TestSubmitRating:
    """POST /api/ratings — submit rating"""

    def test_submit_rating_unauthenticated(self, api, completed_gig):
        """Should return 401 without auth."""
        resp = api.post(f"{BASE_URL}/api/ratings", json={
            "gig_id": completed_gig["gig_id"],
            "rated_user_id": completed_gig["freelancer_id"],
            "punctuality": 4,
            "gear_handling": 3,
            "teamwork": 5,
        })
        assert resp.status_code == 401

    def test_submit_rating_invalid_gig(self, lead_client):
        """Should return 404 for non-existent gig."""
        s = lead_client["session"]
        resp = s.post(f"{BASE_URL}/api/ratings", json={
            "gig_id": "nonexistent-gig-id",
            "rated_user_id": "some-user",
            "punctuality": 3,
            "gear_handling": 3,
            "teamwork": 3,
        })
        assert resp.status_code == 404

    def test_submit_rating_lead_rates_freelancer(self, lead_client, completed_gig):
        """Lead submits rating for freelancer."""
        s = lead_client["session"]
        resp = s.post(f"{BASE_URL}/api/ratings", json={
            "gig_id": completed_gig["gig_id"],
            "rated_user_id": completed_gig["freelancer_id"],
            "punctuality": 4,
            "gear_handling": 5,
            "teamwork": 4,
            "notes": "Great collaborator, very punctual!"
        })
        assert resp.status_code == 200, f"Submit rating failed: {resp.text}"

        data = resp.json()
        assert "message" in data
        assert "avg_score" in data
        assert data["avg_score"] == round((4 + 5 + 4) / 3, 2), f"Unexpected avg_score: {data['avg_score']}"

    def test_submit_rating_duplicate_returns_400(self, lead_client, completed_gig):
        """Should return 400 when rating same user for same gig twice."""
        s = lead_client["session"]
        resp = s.post(f"{BASE_URL}/api/ratings", json={
            "gig_id": completed_gig["gig_id"],
            "rated_user_id": completed_gig["freelancer_id"],
            "punctuality": 3,
            "gear_handling": 3,
            "teamwork": 3,
        })
        assert resp.status_code == 400, f"Expected 400 for duplicate rating, got {resp.status_code}: {resp.text}"
        assert "already" in resp.json().get("detail", "").lower()

    def test_pending_ratings_empty_after_rating(self, lead_client, completed_gig):
        """After rating, gig should be removed from lead's pending list."""
        s = lead_client["session"]
        resp = s.get(f"{BASE_URL}/api/ratings/pending")
        assert resp.status_code == 200

        data = resp.json()
        gig_id = completed_gig["gig_id"]
        still_pending = [r for r in data if r["gig"]["id"] == gig_id]
        assert len(still_pending) == 0, f"Gig {gig_id} should NOT be in pending ratings after submission"

    def test_submit_rating_freelancer_rates_lead(self, freelancer_client, completed_gig):
        """Freelancer submits rating for lead."""
        s = freelancer_client["session"]
        resp = s.post(f"{BASE_URL}/api/ratings", json={
            "gig_id": completed_gig["gig_id"],
            "rated_user_id": completed_gig["lead_id"],
            "punctuality": 5,
            "gear_handling": 4,
            "teamwork": 5,
        })
        assert resp.status_code == 200, f"Freelancer rating lead failed: {resp.text}"
        data = resp.json()
        assert "avg_score" in data
        assert data["avg_score"] == round((5 + 4 + 5) / 3, 2)

    def test_get_user_ratings_after_submission(self, lead_client, completed_gig):
        """Freelancer's rating profile should be updated after submission."""
        s = lead_client["session"]
        freelancer_id = completed_gig["freelancer_id"]
        resp = s.get(f"{BASE_URL}/api/ratings/user/{freelancer_id}")
        assert resp.status_code == 200

        data = resp.json()
        assert "ratings" in data
        assert "avg_rating" in data
        assert "total_ratings" in data
        assert data["total_ratings"] >= 1, "Freelancer should have at least 1 rating"
        assert data["avg_rating"] is not None, "avg_rating should not be None after submission"


# ══════════════════════════════════════════════════════════════════════════════
# NOTES TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestPrivateNotes:
    """GET/PUT/DELETE /api/notes/{freelancer_id} — private lead notes"""

    def test_get_note_unauthenticated(self, api, freelancer_client):
        """Should return 401 without auth."""
        freelancer_id = freelancer_client["user"]["id"]
        resp = api.get(f"{BASE_URL}/api/notes/{freelancer_id}")
        assert resp.status_code == 401

    def test_get_note_returns_empty_when_none_exists(self, lead_client, freelancer_client):
        """Returns {content: '', exists: false} when no note exists."""
        s = lead_client["session"]
        freelancer_id = freelancer_client["user"]["id"]

        # Delete any existing note first (idempotent cleanup)
        s.delete(f"{BASE_URL}/api/notes/{freelancer_id}")

        resp = s.get(f"{BASE_URL}/api/notes/{freelancer_id}")
        assert resp.status_code == 200, f"Get note failed: {resp.text}"

        data = resp.json()
        assert "content" in data
        assert "exists" in data
        assert data["exists"] == False, f"Expected exists=false, got {data}"
        assert data["content"] == "" or data["content"] is None

    def test_put_note_creates_note(self, lead_client, freelancer_client):
        """PUT /api/notes creates/updates a note."""
        s = lead_client["session"]
        freelancer_id = freelancer_client["user"]["id"]

        resp = s.put(f"{BASE_URL}/api/notes/{freelancer_id}",
                     json={"content": "TEST_NOTE: Great with cameras, reliable."})
        assert resp.status_code == 200, f"Save note failed: {resp.text}"

        data = resp.json()
        assert "content" in data
        assert "exists" in data
        assert data["exists"] == True
        assert data["content"] == "TEST_NOTE: Great with cameras, reliable."

    def test_get_note_returns_content_after_save(self, lead_client, freelancer_client):
        """GET returns note content after PUT."""
        s = lead_client["session"]
        freelancer_id = freelancer_client["user"]["id"]

        resp = s.get(f"{BASE_URL}/api/notes/{freelancer_id}")
        assert resp.status_code == 200

        data = resp.json()
        assert data["exists"] == True
        assert data["content"] == "TEST_NOTE: Great with cameras, reliable."

    def test_put_note_updates_existing(self, lead_client, freelancer_client):
        """PUT on existing note updates content."""
        s = lead_client["session"]
        freelancer_id = freelancer_client["user"]["id"]

        resp = s.put(f"{BASE_URL}/api/notes/{freelancer_id}",
                     json={"content": "TEST_NOTE: Updated - excellent team player."})
        assert resp.status_code == 200

        # Verify update persisted
        get_resp = s.get(f"{BASE_URL}/api/notes/{freelancer_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["content"] == "TEST_NOTE: Updated - excellent team player."

    def test_note_privacy_other_user_cannot_see(self, freelancer_client, lead_client):
        """
        Privacy: freelancer viewing lead's profile should NOT see lead's notes.
        Lead's note about freelancer is NOT visible when queried from freelancer's JWT.
        """
        free_s = freelancer_client["session"]
        freelancer_id = freelancer_client["user"]["id"]

        # Freelancer tries to GET notes/{own_id} — will get their own note if any, not lead's
        resp = free_s.get(f"{BASE_URL}/api/notes/{freelancer_id}")
        assert resp.status_code == 200

        data = resp.json()
        # Should be empty since freelancer hasn't written notes about themselves
        # (The lead's note is stored with lead_id=lead, so freelancer's JWT can't see it)
        assert data["exists"] == False, (
            "Freelancer should NOT see the lead's private note about them. "
            f"Got: {data}"
        )

    def test_cannot_add_note_about_yourself(self, lead_client):
        """PUT /api/notes/{own_id} should return 400."""
        s = lead_client["session"]
        own_id = lead_client["user"]["id"]

        resp = s.put(f"{BASE_URL}/api/notes/{own_id}",
                     json={"content": "Note about myself"})
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"

    def test_delete_note(self, lead_client, freelancer_client):
        """DELETE /api/notes removes the note."""
        s = lead_client["session"]
        freelancer_id = freelancer_client["user"]["id"]

        resp = s.delete(f"{BASE_URL}/api/notes/{freelancer_id}")
        assert resp.status_code == 200, f"Delete note failed: {resp.text}"

        data = resp.json()
        assert data.get("success") == True

    def test_get_note_returns_empty_after_delete(self, lead_client, freelancer_client):
        """After delete, GET should return exists=false."""
        s = lead_client["session"]
        freelancer_id = freelancer_client["user"]["id"]

        resp = s.get(f"{BASE_URL}/api/notes/{freelancer_id}")
        assert resp.status_code == 200

        data = resp.json()
        assert data["exists"] == False, f"Expected exists=false after delete, got {data}"

    def test_delete_nonexistent_note_returns_404(self, lead_client, freelancer_client):
        """DELETE on already-deleted note should return 404."""
        s = lead_client["session"]
        freelancer_id = freelancer_client["user"]["id"]

        resp = s.delete(f"{BASE_URL}/api/notes/{freelancer_id}")
        assert resp.status_code == 404, f"Expected 404 for non-existent note, got {resp.status_code}"

    def test_put_note_for_nonexistent_user_returns_404(self, lead_client):
        """PUT on a freelancer_id that doesn't exist should return 404."""
        s = lead_client["session"]
        fake_id = f"nonexistent-{uuid.uuid4()}"

        resp = s.put(f"{BASE_URL}/api/notes/{fake_id}",
                     json={"content": "Test note"})
        assert resp.status_code == 404, f"Expected 404 for non-existent user, got {resp.status_code}: {resp.text}"
