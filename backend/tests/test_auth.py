"""Real-auth regression tests (see services/auth.py and MOCKS.md's Auth
section). These exist because the previous behavior — trusting whatever
user_id a client sent — was a real, exploitable gap: anyone could act as
any engineer. Each test below pins down the specific thing that's supposed
to be impossible now."""
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed


def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


client = TestClient(app)


def _register_engineer(email: str, password: str = "correct-horse-battery"):
    sites = client.get("/api/users/sites/all").json()
    site_id = sites[0]["id"]
    resp = client.post(
        "/api/users/register",
        json={
            "role": "engineer",
            "name": "Auth Test Engineer",
            "email": email,
            "site_ids": [site_id],
            "password": password,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json(), site_id


def test_register_without_password_stays_claimable():
    """The "Add collaborator" admin flow doesn't collect a password on a
    new teammate's behalf — that account is created passwordless (same as
    seed data) and stays open to the demo-login picker until the real
    person registers themselves with a real password, which locks it."""
    sites = client.get("/api/users/sites/all").json()
    resp = client.post(
        "/api/users/register",
        json={
            "role": "engineer",
            "name": "No Password",
            "email": "nopassword@example.com",
            "site_ids": [sites[0]["id"]],
        },
    )
    assert resp.status_code == 200, resp.text
    user_id = resp.json()["user"]["id"]
    assert client.post(f"/api/users/{user_id}/demo-login").status_code == 200

    # Now the real person claims it with an actual password...
    claim = client.post(
        "/api/users/register",
        json={
            "role": "engineer",
            "name": "No Password",
            "email": "nopassword@example.com",
            "site_ids": [sites[0]["id"]],
            "password": "now-its-really-mine",
        },
    )
    assert claim.status_code == 200, claim.text
    # ...and it's locked from then on.
    assert client.post(f"/api/users/{user_id}/demo-login").status_code == 403
    stolen = client.post(
        "/api/users/register",
        json={
            "role": "engineer",
            "name": "Attacker",
            "email": "nopassword@example.com",
            "site_ids": [sites[0]["id"]],
            "password": "wrong-guess",
        },
    )
    assert stolen.status_code == 401


def test_register_short_password_rejected():
    sites = client.get("/api/users/sites/all").json()
    resp = client.post(
        "/api/users/register",
        json={
            "role": "engineer",
            "name": "Short Password",
            "email": "short@example.com",
            "site_ids": [sites[0]["id"]],
            "password": "abc123",
        },
    )
    assert resp.status_code == 422


def test_register_and_login_roundtrip():
    body, _ = _register_engineer("roundtrip@example.com", "supersecret1")
    assert body["access_token"]
    assert body["user"]["email"] == "roundtrip@example.com"

    resp = client.post(
        "/api/users/login",
        json={"role": "engineer", "identifier": "roundtrip@example.com", "password": "supersecret1"},
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_login_wrong_password_rejected():
    _register_engineer("wrongpw@example.com", "supersecret1")
    resp = client.post(
        "/api/users/login",
        json={"role": "engineer", "identifier": "wrongpw@example.com", "password": "not-the-password"},
    )
    assert resp.status_code == 401


def test_reregistering_a_password_protected_email_requires_the_password():
    """Regression test for the exact account-takeover shape this closes:
    registering again with someone else's email used to just merge you into
    their account and hand back their user object (and, now, their token)."""
    _register_engineer("takeover-target@example.com", "the-real-password")
    sites = client.get("/api/users/sites/all").json()
    resp = client.post(
        "/api/users/register",
        json={
            "role": "engineer",
            "name": "Attacker",
            "email": "takeover-target@example.com",
            "site_ids": [sites[0]["id"]],
            "password": "guessed-wrong",
        },
    )
    assert resp.status_code == 401


def test_cannot_reply_to_a_flag_without_a_token():
    flags = client.get("/api/flags").json()
    assert flags, "seed data should include at least one flag"
    resp = client.post(f"/api/flags/{flags[0]['id']}/reply", json={"text": "hi", "actor_user_id": "whoever"})
    assert resp.status_code == 401


def test_cannot_reply_to_a_flag_with_a_forged_actor_id():
    """The old behavior: server trusted body.actor_user_id completely, so
    any authenticated-as-someone client could reply *as anyone else* just by
    changing that field. Now the reply is always attributed to whoever the
    token actually names."""
    body, _ = _register_engineer("real-actor@example.com", "supersecret1")
    token = body["access_token"]
    flags = client.get("/api/flags").json()
    flag_id = flags[0]["id"]

    other_user_id = "some-other-engineer-id-entirely"
    resp = client.post(
        f"/api/flags/{flag_id}/reply",
        json={"text": "this should be attributed to me, not them", "actor_user_id": other_user_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    detail = resp.json()
    last_message = detail["messages"][-1]
    assert last_message["sender_name"] == "Auth Test Engineer"


def test_forged_token_rejected():
    resp = client.get("/api/assistant/ask")  # wrong method, but headers still parsed first for POST-only route
    assert resp.status_code in (401, 405)
    resp = client.post(
        "/api/assistant/ask",
        json={"engineer_id": "x", "question": "anything pending?"},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert resp.status_code == 401


def test_demo_login_blocked_once_password_is_set():
    body, _ = _register_engineer("demo-blocked@example.com", "supersecret1")
    user_id = body["user"]["id"]
    resp = client.post(f"/api/users/{user_id}/demo-login")
    assert resp.status_code == 403


def test_demo_login_works_for_seeded_passwordless_account():
    engineers = client.get("/api/users?role=engineer").json()
    # Exclude accounts this test module itself registered with a password —
    # pick an actual seed engineer, identified by not being one of ours.
    seeded = [e for e in engineers if not (e["email"] or "").endswith("@example.com")]
    assert seeded, "seed data should include at least one engineer"
    resp = client.post(f"/api/users/{seeded[0]['id']}/demo-login")
    assert resp.status_code == 200
    assert resp.json()["access_token"]
