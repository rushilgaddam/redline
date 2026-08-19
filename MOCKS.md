# Mock inventory

Every place this prototype fakes something a real deployment would need to do for
real, what it fakes, what the real implementation requires, and how we'd validate
accuracy once it's real. Update this file whenever a mock is added, changed, or
graduated to a real implementation — treat it as the actual punch list for
production-readiness, not a one-time note.

Status legend: 🔴 not started · 🟡 mocked · 🟢 real

---

## 🟢 Title-block OCR equipment resolution

**File:** `backend/app/services/title_block_ocr.py`, tests in
`backend/tests/test_title_block_ocr.py`

**What's real:** Genuinely real, not mocked — a title-block thumbnail is
rendered per drawing (standing in for the photo a technician would take of
the drawing's bottom-right corner) and Tesseract (`pytesseract`, local
binary, no API key) actually reads the pixels. `resolve_by_title_block`
never trusts which drawing the client claims it photographed — only what
OCR extracts from the image file on disk, validated against real rows in
the database.

**What's simulated:** The camera. The technician simulator's "scan title
block" picker lets you choose *which* stored image to feed the pipeline
(there's no real camera in a browser demo), but everything downstream is a
real OCR call, same as the DXF/PDF parsing in `ingest.py`.

**Measured accuracy** (see `test_title_block_ocr.py`, 15 tests, all
passing): resolves correctly through mild blur, low contrast, dim
lighting, JPEG compression at quality 25, and skew up to ±14° (via a
rotation-retry sweep — °3/6/10/14 in both directions). **Known failure
modes, tested and documented, not guessed:** skew beyond ~±14°, heavy
blur, and low-resolution/far-away shots all currently fail to resolve.
Critically — and this is the property that actually matters — every
failure mode tested fails *closed* (returns no match, falls through to the
normal ask-flow) rather than resolving to the wrong drawing; there's an
explicit regression test for this
(`test_never_resolves_to_the_wrong_drawing`).

**A real bug this caught:** the first version of the rotation-retry sweep
returned on the first *non-empty* OCR read rather than the first *correct*
one — a misread (e.g. an em-dash glyph read as "£") still counts as
non-empty, so the sweep was silently a no-op until the retry loop was
rewritten to validate each candidate against a real row in the database.
Caught by the accuracy tests, not by inspection — worth remembering as the
general lesson for anything else that gets "graduated" out of mock status.

**Real-world gap still open:** the title-block *content* itself is
synthetic (rendered from the drawing's own stored fields), not a photo of
an actual physical drawing. Real accuracy against real phone photos —
warped paper, reflections, partial occlusion, handwritten
revision-clouds — is untested and will differ from these numbers.

---

## 🟡 Vision + Context Agent (technician SMS answers)

**File:** `backend/app/services/vision_agent.py`

**What's mocked:** Region matching and confidence scoring are deterministic
token-overlap (Jaccard-style) between the technician's note + a hardcoded
"photo hint" string, and each region's label/description/keywords. Diagnoses
come from a hand-authored `known_issues` list per region (baked into
`seed.py`), not from reasoning over the drawing's `context_block`. No actual
image is ever analyzed — `photo_ref` is a fixed id mapped server-side to a
short hint string. Confidence = weighted overlap score + a deterministic
hash-based jitter, not a model's real calibration.

**What real needs:** A Claude vision-capable API call (multimodal) per §4.4
of the architecture — photo bytes + technician's raw text + the resolved
drawing's region list + `context_block` + `revision_notes`, returning
structured `{region_id, confidence, reasoning, diagnosis|null}`, instructed
to say "not enough information" rather than fabricate.

**Accuracy validation plan (not yet run):** Build a labeled eval set —
real (or realistic) technician photos + notes, each with a ground-truth
region and a human-judged "should this have been answered confidently or
escalated" label. Measure: region-match accuracy, false-confident-answer
rate (the one that matters most per §0.3 — answering when it shouldn't),
escalation precision/recall. No such set exists yet.

---

## 🟡 CAD-QA background agent (proactive drawing scan)

**File:** `backend/app/services/cad_qa.py`

**What's mocked:** `run_cad_qa_scan` only replays a hardcoded list of
findings (`Drawing.cad_qa_findings`) written by hand for the 3 seed
drawings. There is **no actual detection logic** — no wire-endpoint/BOM
cross-reference, no orphaned-reference check, no GD&T/critic pass. For any
drawing added through the real ingestion flow, `cad_qa_findings` is `[]`, so
clicking "Run scan" silently returns zero findings — indistinguishable in
the UI from "scanned, found nothing clean." That's a known gap (see below).

**What real needs:** Two tiers per §6 —
1. Deterministic, zero-model-call checks (wire endpoint → real connector pin,
   part number → BOM, no orphaned refs, no duplicate pin assignments) —
   fully buildable now against parsed DXF entities (`ingest.py` already
   extracts real geometry), no Sonnet needed.
2. A differently-prompted critic-agent pass + ensembling for GD&T/cross-view
   reasoning only, with a hard confidence floor gating what reaches
   technicians as "ready."

**Known UI gap to fix:** distinguish "scanned, clean" from "scanned, no
detection logic exists for this drawing" — right now they look identical.

**Accuracy validation plan:** Precision/recall against drawings with known,
injected defects (e.g. deliberately mismatched wire counts, orphaned pin
refs) for the deterministic tier — this is checkable today, no model
needed. For the critic-pass tier: inter-rater agreement between the model
and a human reviewer on a held-out set of real drawing defects.

---

## 🟡 CAD-QA region labeling on ingestion

**File:** `backend/app/services/ingest.py`

**What's mocked:** Region *geometry* is real (see below), but region
*names/descriptions* are generic placeholders ("Region 1," "Auto-detected
cluster of N entities") — no semantic labeling. The engineer renames them
by hand in the region editor before confirming.

**What real needs:** A pass that reads each cluster's entities (text labels
in/near it, symbol shapes) and proposes a real name — this is a good fit for
a cheap/fast model call (Haiku-class) per cluster, since it's a narrow,
bounded task, not a full-drawing read.

**What's real already:** DXF parsing (`ezdxf`, including block/`INSERT`
expansion) and PDF vector-path extraction (`pymupdf`) are genuine — actual
file geometry, not fabricated. Spatial clustering into region candidates is
a real deterministic algorithm (union-find over entity bounding boxes), not
mocked, just unlabeled.

---

## 🟡 Site Knowledge Agent (Outlook / Teams / external context)

**File:** `backend/app/services/site_knowledge.py`, `backend/app/routers/knowledge.py`

**What's mocked:** "Connecting" a source is a UI flow with no real OAuth —
no Microsoft Graph API call, no Azure AD app registration, nothing actually
reads a real inbox or Teams channel. Ingested content is manually
pasted/typed by the engineer standing in for what a real sync would pull.
Retrieval against ingested documents is the same token-overlap heuristic as
`vision_agent.py`, not real embeddings/semantic search.

**What's real (as of the connector-scope rework):** `KnowledgeSource.scope_items`
is a genuinely enforced allow-list, not decoration — `POST /api/knowledge/sources`
rejects any non-manual connection with an empty scope
(`backend/app/routers/knowledge.py`), and the connector UI (`SiteKnowledgePage.tsx`,
`ConnectSourceModal.tsx`) only ever lets an engineer name specific
labels/folders/channels, never "everything." The mock is *what's behind*
the connection (no real Graph API call), not *whether scope is tracked and
required* — that part would carry over unchanged to a real OAuth
integration, since it would just gate which folders/labels get requested
in the consent screen.

**What real needs:** Microsoft Graph API integration (Outlook Mail API,
Teams chat/channel API) via OAuth on behalf of the connecting user or an
org-level app registration; a real sync/webhook pipeline instead of
one-shot paste; embeddings (sentence-transformers/Voyage AI + pgvector, per
§9's stated stack) for retrieval instead of token overlap; PII/redaction
handling before anything from a real inbox is stored, given this is now
ingesting arbitrary company email/chat content, not just engineering
drawings.

**Accuracy validation plan (not yet run, and can't be until real ingestion
exists):** Once real sync is in place — a held-out set of technician
questions with human-labeled "was there actually a relevant email/Teams
message in this site's history" ground truth, measuring retrieval
precision/recall and, critically, the false-confident-answer rate this
unlocks (this feature's entire point is letting the AI answer confidently
using context it didn't have before — that's exactly the failure mode to
stress-test hardest, since a wrong answer sourced from a real email reads
as more credible, not less).

**Privacy note, not yet addressed:** connecting a real inbox/Teams tenant
means ingesting arbitrary company communications, not just engineering
content. Retention policy, access scope (whose emails, which channels),
and redaction all need a real design pass before this touches real data —
today's mock sidesteps it entirely since content is manually pasted by the
same engineer who'd be granting access.

---

## 🟡 Engineer AI assistant ("Ask anything")

**File:** `backend/app/services/assistant.py`, `backend/app/routers/assistant.py`,
frontend `components/AssistantChat.tsx`

**What's real:** Every answer is computed live against the actual
database — open/tentative/resolved counts, per-discipline breakdowns,
overdue-by-SLA calculations, specific-drawing lookups — not a canned
string and not a real LLM call. `POST /api/assistant/ask` genuinely
queries flags/drawings scoped to the asking engineer (or site-wide for a
reviewer) and returns real numbers.

**What's mocked:** The natural-language *routing* — matching the
engineer's free-text question to one of a handful of intents (pending /
overdue / resolved-today / status-summary / specific-drawing) — is a
deterministic keyword/regex matcher (`answer_question` in
`assistant.py`), not real NLU. It only understands the phrasings it's
built for; anything else gets an honest "here's what I can answer"
fallback rather than a hallucinated guess.

**What real needs:** Route the question through the same Claude API call
that would eventually power vision/context answers, with these same
DB-query functions exposed as tool calls — the computation layer here is
already correct and wouldn't need to change, only the intent-matching
layer would move from regex to a real model.

**Accuracy validation plan (not yet run):** A labeled set of engineer
questions phrased naturally (not matching the current regex patterns) to
measure how often the fallback triggers on questions a real NLU layer
should have handled — this is the main gap once graduated.

---

## 🟡 Knowledge reuse (past resolved flags)

**File:** `backend/app/services/knowledge_reuse.py`

**What's mocked:** Jaccard token-overlap between the new note and past
resolved flags' notes, instead of real embeddings.

**What real needs:** sentence-transformers or Voyage AI embeddings +
pgvector, per §9's stated stack — direct drop-in, the surrounding logic
(threshold, "surface but never suppress escalation") doesn't need to change.

---

## 🔴 SMS/MMS transport (Twilio)

**File:** `backend/app/routers/sms.py` (`/api/sms/inbound`), Technician
Simulator frontend page

**What's mocked:** No Twilio at all. The Technician Simulator page's "send"
button calls the same `/api/sms/inbound` endpoint a real Twilio webhook
would call, with a phone-style UI standing in for a real SMS thread. Photos
are a fixed menu of fake ids (`MOCK_PHOTOS`), never real MMS attachments.

**What real needs:** Twilio Programmable Messaging webhook wired to
`/api/sms/inbound` (or a thin adapter in front of it), MMS media download
from Twilio's URLs into real storage, and the on-prem SMS gateway option
§9 calls out for regulated customers.

---

## 🔴 Photo capture / storage

**What's mocked:** Entirely — there are no real photos anywhere in this
prototype. `PhotoCard` renders a stylized placeholder from a fixed id.

**What real needs:** Real object storage (S3-compatible per §9), a
retention policy (explicit, configurable, short-by-default per §10), and
the actual MMS-to-storage pipeline mentioned above.

---

## 🔴 Auth (SSO/SAML for engineers)

**What's mocked:** "Login" is picking an engineer from a list — no
password, no SSO, no session/token of any kind.

**What real needs:** SSO/SAML via an IdP integration (WorkOS/Auth0 per §9),
row-level security enforcing org/site/discipline scoping server-side
(today every endpoint trusts whatever `actor_user_id` the client sends).

---

## 🔴 PLM/CAD connector

**What's mocked:** Nothing built — this prototype's only ingestion path is
manual upload (`/drawings/ingest`). Explicitly Phase 5 in the architecture
doc's own phasing table, called out as the real sales-blocking dependency.

**What real needs:** Teamcenter/Windchill/SolidWorks PDM API integration,
per-customer.

---

## 🟢 Real (not mocked)

- Drawing ingestion geometry parsing (DXF via `ezdxf`, PDF vector paths via
  `pymupdf`) — actual file parsing, not fabricated.
- Region spatial clustering (union-find over entity bounding boxes) — a
  real deterministic algorithm.
- Confidence-gate control flow, routing/backup-chain logic, drawing
  open/closed lifecycle, audit trail, real-time WebSocket sync — all real
  application logic; only the *judgment calls* feeding into them (vision
  scoring, CAD-QA findings, retrieval) are mocked.
