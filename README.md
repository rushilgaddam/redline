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

## Adding a real drawing

"Add drawing" in the sidebar takes a real CAD export — `.dxf` is parsed as actual vector geometry
(`ezdxf`, including `INSERT`/block expansion) and rendered with the same shape system as the seeded
demo drawings; `.pdf` is rendered as an image background, plus its vector paths are pulled for
region clustering when it's a print-to-PDF export rather than a scan. DWG isn't parseable without
Autodesk's SDK — export as DXF instead.

Regions are auto-suggested by spatially clustering the file's own geometry (a real deterministic
heuristic, not an AI call — see `backend/app/services/ingest.py`), then an engineer confirms,
renames, drags, resizes, or draws them by hand before the drawing goes live. Until confirmed, the
drawing is `confidence_floor_status = needs_review`: technician SMS about it still routes, but always
as a direct escalation, never a tentative AI answer (§3.5 of the architecture doc).

A technician can also mark a drawing's physical build as complete (`status = closed`) from the
simulator once a QR tag is scanned. A new technician flag against a closed drawing automatically
reopens it.
