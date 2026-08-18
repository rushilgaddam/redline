# Redline

Prototype of the system described in `redline-architecture.md`: a technician texts a photo of
equipment, an AI agent maps it to a point on the drawing and attempts a grounded answer, and the
drawing's author-of-record engineer picks it up in a real-time inbox.

This is a full-stack prototype with mocked external services (no Twilio, no live Claude API calls,
no PLM connector) — the region index, confidence gating, routing, knowledge reuse, and CAD-QA agent
are all real logic, just running against a deterministic mock vision/AI service instead of a paid one.

## Run it

**Backend** (FastAPI + SQLite, seeds itself on first boot):

```
cd backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/uvicorn app.main:app --reload --port 8000
```

**Frontend** (React + Vite, proxies `/api` and `/ws` to the backend):

```
cd frontend
npm install
npm run dev
```

Open the printed Vite URL. Pick an engineer to see the inbox, or open the technician simulator
(phone icon / `/technician`) to text a photo in from the other side — changes show up in the
engineer inbox in real time over the same WebSocket the real app would use.

To reset the demo data, stop the backend and delete `backend/redline.db`.
