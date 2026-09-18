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

**Two real bugs this heuristic had, caught by live end-to-end testing (not
just reading the code):**
1. The tokenizer's `len(word) > 2` filter — shared by this file,
   `knowledge_reuse.py`, and `site_knowledge.py` — silently dropped every
   2-character token, which is exactly this domain's own naming convention
   for equipment IDs (K1–K4, T1, F1–F4). A note about "K2 chattering"
   couldn't match a region literally labeled "K2" on the token that matters
   most. Fixed by dropping the length filter (the explicit stopword list
   already covers short function words) and normalizing hyphens so
   "CB-3"/"TB-1" survive as one token instead of splitting into two
   fragments that are each too short to matter.
2. Once equipment IDs survived, a second, subtler gap showed up: "Panel A"
   and "Panel B" both tokenized to just `{"panel"}` — the bare trailing
   letter was too short to keep on its own. A note about Panel A's
   corrosion confidently cross-referenced a connected knowledge doc about
   *Panel B's* corrosion, because nothing in the token set distinguished
   them. This is exactly the false-confident-answer failure mode called out
   above as the one to stress-test hardest — caught here by actually
   constructing an ingested drawing with two similarly-named regions and
   asking about one of them, not by inspection. Fixed by gluing a bare
   trailing single letter/digit onto the word before it ("panel" + "a" →
   "panela"), the same idea as the hyphen fix, in all three tokenizers.

---

## 🟡 CAD-QA background agent (proactive drawing scan)

**File:** `backend/app/services/cad_qa.py`, `backend/app/services/cad_qa_checks.py`
(tier 1, real), `backend/tests/test_cad_qa_checks.py`

**What's real (as of the tier-1 rework):** Tier 1 — the deterministic,
zero-model-call checks §6 calls for — is now real for any drawing ingested
via DXF upload. `cad_qa_checks.py` runs three genuine geometric/text checks
against the drawing's own parsed entities at ingest time (`ingest.parse_dxf`
now keeps real `text_entities`/`line_segments`/`circle_centers`, not just
the flattened SVG shape list that used to be all that survived parsing):
1. **Dangling wire endpoint** — a line endpoint with no other line endpoint,
   terminal/junction circle, or label within tolerance. DXF carries no
   netlist, so this is a geometric proxy for continuity, not true net
   tracing — documented as such, and it fails toward flagging-for-review,
   never toward silently "fixing" anything.
2. **Duplicate reference designator across regions** — the same equipment
   tag (K1, TB-1, CB-3, ...) found inside two different auto-suggested
   regions. A tag repeating *within* one region (its own symbol + its own
   label) is normal and correctly not flagged — only a cross-region repeat
   is, which is the actual "same tag, two different things" failure shape.
3. **Unclustered label** — a real equipment-tag-shaped text entity that
   falls outside every suggested region's bounding box.
`Drawing.cad_qa_checks_available` is set `True` only when these actually
ran (DXF ingests), letting the UI (`DrawingPage.tsx`) tell "scanned, clean"
apart from "scanned, but no detection logic exists for this drawing" —
closes the exact known gap this section used to flag. 9 unit tests on the
pure check functions plus one full ingest-endpoint integration test (a
real in-memory DXF built with `ezdxf`, containing a deliberately duplicated
tag, asserted to surface a real `duplicate_reference_designator` finding
through the actual `/api/drawings/ingest` pipeline) in `test_cad_qa_checks.py`.

**What's still mocked:** Everything not covered above —
- No wire-endpoint→BOM or part-number→BOM cross-reference (no BOM data
  exists anywhere in this prototype to check against).
- No duplicate-pin-assignment check in the true ECAD sense (pin/net data
  isn't in a DXF at all — the duplicate-designator check above is the
  closest geometric proxy available without a real netlist).
- Tier 2 — the critic-agent pass for GD&T/cross-view reasoning — is still
  entirely unbuilt; a differently-prompted model pass + ensembling, with a
  hard confidence floor gating what reaches technicians as "ready," per §6.
- The 3 seed drawings' findings are still hand-authored (representing what
  a full real system, tier 1 + tier 2, would eventually surface) rather
  than tier-1-computed — `cad_qa_checks_available` stays `False` on those,
  honestly reflecting that the real check code never actually ran on them.
- PDF ingestion still gets no deterministic checks at all (no reliable
  text/line entity split from a raster-backed PDF the way DXF gives one).

**Accuracy validation plan:** Precision/recall against drawings with known,
injected defects for tier 1 is now partially exercised (the ezdxf-built
fixture in `test_cad_qa_checks.py`) but not yet run against a larger corpus
of real, varied DXF exports — that's the next step before trusting false-
positive/false-negative rates at any scale. Tier 2 still needs inter-rater
agreement between the model and a human reviewer on a held-out set of real
drawing defects, unchanged from before.

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

## 🟡 Auth (SSO/SAML for engineers)

**File:** `backend/app/services/auth.py`, `backend/app/routers/users.py`
(`/register`, `/login`, `/{id}/demo-login`), `frontend/src/pages/LoginPage.tsx`,
`backend/tests/test_auth.py`

**What's real (as of the password/session rework):** Registration and
sign-in are genuine lookups against the database, not a fixed roster —
`POST /api/users/register` creates a real `User` row (validating role,
requiring a project selection, normalizing phone numbers) and `POST
/api/users/login` does a real query by email (engineer/reviewer) or phone
(technician). Engineer/reviewer accounts now have a real password: bcrypt
hashing (`bcrypt`, no plaintext ever stored), a signed JWT session token
issued on register/login/demo-login (`PyJWT`, HS256, 12h expiry, secret
from `REDLINE_JWT_SECRET`), and a `get_current_user` FastAPI dependency
that decodes and verifies that token — applied to every engineer-facing
mutating endpoint (`flags` reply/resolve, `drawings` ingest/regions/confirm,
`knowledge` source-connect/scope/documents, `assistant/ask`, avatar
upload/remove). Those endpoints now attribute the action to whoever the
verified token names, not to whatever `actor_user_id`/`engineer_id` the
request body claims — see `test_cannot_reply_to_a_flag_with_a_forged_actor_id`
for the regression test on the exact hole this closes (a client used to be
able to reply to a flag "as" any engineer just by changing a body field).
Re-registering with an email that already has a password set now requires
that password — closes the account-takeover shape where "register again
with someone else's email" silently merged you into their account and
handed back a session for it.

**What's still a deliberate simplification, not an oversight:**
- Technicians stay identity-by-phone-number with no password — this
  matches real SMS/MMS (Twilio never asks a phone for a password either;
  the phone number *is* the identity), not a gap to close later.
- `/api/sms/inbound` still doesn't require a bearer token — its real
  security boundary is a Twilio webhook signature (see the SMS/MMS section
  below), not a per-user session, matching what a real deployment's trust
  model would actually be.
- Accounts created without ever setting a password (seed/demo data, or one
  created via "Add collaborator" on a teammate's behalf) stay reachable
  through the login screen's "explore as an existing demo user" picker —
  intentionally, so local demo/dev usage is unchanged — via a
  `/{id}/demo-login` endpoint that only succeeds for a password-less
  account. The first registration that supplies a real password for that
  identity claims and locks it from then on (`test_register_without_password_stays_claimable`
  exercises the full claim lifecycle). This is a strict improvement over the
  prior state (where *every* account was reachable that way, forever), not
  a new hole — an unclaimed identity was already fully impersonable before
  this existed.

**What real still needs:** SSO/SAML via an IdP integration (WorkOS/Auth0
per §9) for engineers/reviewers instead of homegrown password auth, a
refresh-token/revocation story (the current JWT can't be invalidated before
it expires — fine for a 12h demo session, not for production), and
row-level security enforcing org/site/discipline scoping server-side beyond
"is this the right individual" (e.g. a reviewer on one site's queue
shouldn't be able to `reply` on a flag routed to a completely different
org's engineer just because they're both authenticated engineers — that
cross-org check doesn't exist yet).

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
