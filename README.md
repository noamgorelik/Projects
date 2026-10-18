# QA Automation and Product Support Portfolio

This beginner-friendly portfolio aims to demonstrate balanced QA automation and
product support skills through small, practical projects.

## Planned projects

- **UI QA:** Check user-facing flows and build automated browser tests.
- **[API testing](projects/api-qa/README.md):** Native Postman collection:
  17 requests / 36 passing assertions. First automated API run: all 12 tests
  passed (user-reported). Hosted API: 12 passed; UI regression: 10 passed.
  Run links, test durations, and artifact results are in the API documentation.
- **[Product Support and SQL Lab](projects/support-sql/README.md):** Cases 1 and 2
  manually verified (user-observed); Case 3 remains planned. Isolated
  fictional fixtures and seeded defects; existing CI covers the portal UI/API.

All three projects will use a shared practice product: a fictional SaaS
subscription portal with fictional accounts and practice data.

## First milestone: sign-in

The first milestone will include:

- Sign-in using fictional accounts.
- A successful sign-in flow.
- An invalid-credentials error.
- Two Playwright tests: one for successful sign-in and one for invalid credentials.

## Current status

This project is in progress. The sign-in application is implemented. Playwright
tests are now implemented for successful sign-in and invalid credentials.
Manual HTTP verification has checked the server startup, health endpoint, and
login responses. See the test section below for browser verification results.
The session milestone's application portion is implemented: refresh restoration,
sign-out, and rejection of unauthenticated account requests. Three new browser
tests cover these flows alongside the two original sign-in tests.
The subscription application's plan display and confirmed cancellation are now
implemented. Five subscription tests have now been added alongside the five
unchanged sign-in/session tests. User-observed manual checks and the visible
ten-test run passed as recorded below. Hosted ten-test verification also passed;
the run is linked in the CI section.

## Setup and startup

Use Node.js 24 and npm. Install the locked dependencies:

```sh
npm ci
npm start
```

Open http://127.0.0.1:3000 in your browser. Stop the server with Ctrl+C.
To choose another port on macOS or Linux, run `PORT=3001 npm start`.
The server binds only to `127.0.0.1`.

Express is pinned to version 5.3.0. The initial dependency installation command is
`npm install --save-exact express@5.3.0`.

## Fictional credentials

- Email: `demo@example.test`
- Password: `Practice123!`

Try these credentials to see “Sign-in successful.” Change the password to see
“Email or password is incorrect.” The page submits without reloading.
You can inspect requests in your browser's developer tools Network panel.
GET `/health` returns `{"status":"ok"}`.

## Current limits

This is a local HTTP session demonstration, not production authentication.
The single fictional account is hard-coded for practice; do not enter real
credentials. There is no database or account creation. The subscription is
fictional: no prices, payments, refunds, reactivation, or plan changes are
implemented. The ten-test suite covers sign-in, sessions, subscription display,
keeping/cancelling a subscription, unauthenticated requests, and one mobile
viewport. The sign-in/session and subscription results are recorded separately.
One-hour expiry and server restart behavior do not have automated coverage.

## Sessions and sign-out

A successful `POST /api/login` keeps its original JSON response and creates a
cryptographically random session ID. The server stores the account and a fixed
one-hour expiry in memory. The ID is sent only in the `practice_session` cookie,
with `HttpOnly`, `SameSite=Lax`, `Path=/`, and a one-hour lifetime. It is not
included in JSON, page content, or logs. The browser sends the cookie with API
requests; browser JavaScript cannot read the HttpOnly cookie.

- `GET /api/me`: returns 200 with the account email for a valid session, or
  401 with `{"error":"UNAUTHENTICATED","message":"Please sign in."}` for a
  missing, unknown, or expired session.
- `POST /api/logout`: deletes the session, clears the cookie, and returns 204
  without a body, including when already signed out.
- Authentication and account API responses use `Cache-Control: no-store`.

The page checks `/api/me` before enabling sign-in interactions. After sign-in,
it shows the account email and a **Sign out** button. Sessions survive page
refresh while valid, but not a server restart. Expiry is fixed rather than
extended by activity. A failed sign-out request displays an error without
claiming that sign-out succeeded.

To inspect manually, start the app, sign in with the fictional credentials,
refresh to confirm the account remains visible, then sign out and refresh again.
Use the Network panel to inspect `/api/me` and `/api/logout` responses.

This local HTTP demo intentionally omits the cookie's `Secure` flag. It has no
durable or shared session store, production CSRF protection, or login rate
limiting. It is intended for local practice, not deployment with real accounts.

Verification on October 15, 2026: HTTP checks confirmed missing/unknown-session
rejection, the login cookie flags and lifetime, authenticated account access,
cookie clearing, logout invalidating the old session, idempotent logout, and
`no-store` responses (including malformed login JSON). Session IDs were not
printed. The one-hour expiry was reviewed in code rather than tested by waiting
an hour. Strict TypeScript checking passed, and both unchanged Chromium sign-in
tests executed and passed with one worker and no retries at the application-only
stage. The browser coverage added afterward is recorded below.

## Fictional subscription

After sign-in or session restoration, the account area loads a **Practice Plus**
subscription. It starts **Active**. **Cancel subscription** opens an inline
confirmation section with this text:

> Cancel Practice Plus immediately? This is fictional practice data.
> No payment will be taken or refunded.

**Keep subscription** closes the section without sending a cancellation request.
**Confirm cancellation** submits the request. After confirmed success, the page
shows **Cancelled** and “Subscription cancelled.” Cancellation controls are then
hidden. Cancellation is immediate and does not sign the user out.

Subscription state is stored per account in server memory, separately from
sessions. Cancellation survives refresh and signing out/in while the server
runs. Restarting the server resets it to Active and clears all sessions. Other
browser sessions for the same fictional account share the subscription; refresh
to load its latest state. A database remains deferred to the later API/database
milestone. A guarded reset endpoint now provides test isolation as described below.

Both endpoints use the account from its valid session, never a submitted email,
and return `Cache-Control: no-store`:

- `GET /api/subscription`: 200 with
  `{"subscription":{"plan":"Practice Plus","status":"active"}}`.
  After cancellation, `status` is `"cancelled"`.
- `POST /api/subscription/cancel`: requires JSON `{"confirm":true}` and returns
  200 with `{"message":"Subscription cancelled.","subscription":{"plan":"Practice Plus","status":"cancelled"}}`.
  Repeating a confirmed cancellation returns the same result.
- Missing, unknown, or expired sessions receive the existing 401 response:
  `{"error":"UNAUTHENTICATED","message":"Please sign in."}`.
- For parsed requests, authentication is checked before confirmation validation.
  Missing/invalid confirmation receives 400 with
  `{"error":"INVALID_CONFIRMATION","message":"Send JSON with confirm set to true to cancel your subscription."}`
  without changing state. Malformed JSON still uses the existing parser error.

Loading and cancellation disable subscription controls while pending. Failed
requests show a useful error and offer **Retry loading subscription**; cancellation
can also be retried. A failure does not claim successful cancellation. If the
network fails after the server processes cancellation, retry loading checks its
actual status. Subscription API 401 responses show the signed-out view. Late
subscription responses are ignored once sign-out begins. The existing exact
login messages and session expiry rules are preserved.

User-observed manual evidence supplied in this conversation:

- Practice Plus initially displayed Active. `GET /api/subscription` returned
  200 with `{"subscription":{"plan":"Practice Plus","status":"active"}}`.
- Keep subscription closed confirmation without a cancellation POST.
- Confirm cancellation sent `{"confirm":true}` and returned 200 with
  `{"message":"Subscription cancelled.","subscription":{"plan":"Practice Plus","status":"cancelled"}}`.
  The success message displayed and cancellation controls were hidden.
- Cancelled persisted after refresh and sign-out/sign-in.
- Restarting the server cleared the session and reset the subscription to Active.
- At 390 × 844, text/buttons were readable with no overlap, cut-off content,
  or horizontal scrolling. Keep, confirm, and refresh persistence worked.

These are user observations, not checks independently rerun during the later
code review. Earlier sign-in/session evidence remains recorded separately.

Manual walkthrough:

1. In the project folder, run `npm start` and open http://127.0.0.1:3000.
   If you already run an older version, stop only that server you own and start
   it again to load the changed server code. If 3000 is occupied by another
   process, use `PORT=3001 npm start` and http://127.0.0.1:3001 instead.
2. Sign in with `demo@example.test` / `Practice123!`. Inspect Practice Plus and
   Active in the account area.
3. Open cancellation, choose Keep subscription, and check the Network panel:
   no cancellation request should be sent.
4. Open it again and confirm. Inspect the successful POST response, Cancelled
   status, success message, and hidden cancellation controls.
5. Refresh, then sign out/in. The subscription should remain Cancelled.
6. While signed out, inspect `GET /api/subscription` in the browser: expect 401.
   During the later API checks, also verify unauthenticated cancellation,
   invalid confirmation, and repeated confirmed cancellation.
7. Use browser developer tools at a 390 × 844 viewport to inspect the layout,
   confirmation text, and buttons. Restart your server to reset Active before
   repeating the full cancellation flow. Restart also requires signing in again.
8. Optionally use developer tools network controls to inspect loading/request
   failure recovery. Return online and retry loading; avoid claiming success
   from a failed request.

The subscription manual observations above and headed automated results below
now supplement the earlier syntax and TypeScript checks. Historical two-test
and five-test records describe the earlier sign-in/session implementation.

## UI QA tests

After `npm ci`, install Playwright's Chromium browser:

```sh
npx playwright install chromium
npm run typecheck
npm test
```

The initial development dependency installation command is:

```sh
npm install --save-dev --save-exact @playwright/test@1.64.0 typescript@5.9.3 @types/node@24.19.2
```

`npm run test:headed` runs all ten tests with the browser visible. Its
user-reported result is recorded in the subscription test section below.
The tests use independent browser contexts, labeled fields, and the actual API.
They verify login status/JSON/messages, account email after refresh, the browser
logout's 204 status and cookie removal, rejection when replaying the deleted
session cookie, and a fresh browser's 401 response and signed-out view. Account
email assertions are scoped to the account area, away from the public practice
note. The error wording is “Email or password is incorrect.”

Playwright starts and stops its own server with `PORT=3100`, waits for
http://127.0.0.1:3100/health, and uses http://127.0.0.1:3100 as the base URL.
It does not reuse an existing server. If port 3100 is occupied, the run fails;
it does not stop that other process. There is one desktop Chromium project,
one worker, and no retries.

The HTML report is generated in `playwright-report/` without opening automatically.
Run `npx playwright show-report` to inspect it. Failure screenshots and traces
are retained in `test-results/`. Both generated folders are ignored by Git.

Verification on October 14, 2026: `npm run typecheck` passed, and `npm test`
executed exactly two Chromium tests: both passed, with no retries. The browser
confirmed the exact success and invalid-credentials messages. No application
correction was needed. Playwright stopped its own test server after the run.

The three session tests observe actual browser response statuses and verify the
visible account or signed-out view. They check exact account/error JSON with
separate real `context.request.get('/api/me')` requests using the browser
context's cookie jar. These body checks concern separate API transactions, not
the browser responses observed during navigation. The deleted-cookie replay
also uses a real API request and verifies 401 with the exact error JSON.

For logout, the browser click's response is checked for status 204 without
reading its body. A later API logout request verifies 204 with an empty body
while already signed out. That final check covers repeated logout; it does not
inspect the body of the response generated by the earlier click. No Fetch
instrumentation or response mocking is used.

Session-test verification on October 15, 2026: after simplification,
`npm run typecheck` passed and `npm test` executed exactly five Chromium tests:
all passed with one worker and no retries (3.8 seconds). The original two tests
remain unchanged. The earlier implementation encountered a protocol error
reading the browser logout body and a timeout reading a browser 401 body; their
underlying cause was not established. The response-cloning workaround has been
removed in favor of the separate API checks described above. No application
correction was needed. Tests used their own server on port 3100; the manual
server on port 3000 was left alone.

## Subscription tests and isolation

`projects/ui-qa/tests/subscription.spec.ts` defines exactly five new tests:

1. Signed-in account displays Practice Plus / Active.
2. Keep subscription closes confirmation, sends no cancellation request during
   the observed interaction through refresh, and retains Active. The test listens
   for real requests rather than waiting a fixed time to infer absence.
3. Confirm cancellation sends `{"confirm":true}`, returns 200, shows Cancelled
   and the success message, hides cancellation controls, and survives refresh.
   A separate confirmed API cancellation verifies the exact repeated-success JSON.
4. Unauthenticated viewing and cancellation both return the exact existing 401 JSON.
5. At 390 × 844, real controls complete cancellation and refresh, with horizontal
   overflow checks before, during confirmation, and after cancellation/refresh.
   This is a viewport check, not testing a physical mobile device.

Browser response waits are registered before the actions that trigger them.
Browser statuses and visible views are checked directly. Separate API requests
check exact stored subscription JSON and the repeated-cancellation response;
those bodies belong to separate requests, not the browser click response.
There are no Fetch wrappers, mocked responses, arbitrary delays, or cookie-value
logging. The five existing sign-in/session tests are unchanged.

Subscription data is shared per account, so a new browser context alone cannot
reset it. Before each subscription test, Playwright's API client calls
`POST /api/test/reset-subscription`, which resets the fictional account's
subscription to Active and returns 204 without changing sessions. The endpoint
is registered only when `PRACTICE_TEST_RESET=1`. That flag is set only in
Playwright's `webServer.env`, alongside `PORT=3100`. Ordinary `npm start` without
the flag does not expose this endpoint. It is an unauthenticated test utility;
do not enable it for a manual or deployed portal.

All tests use the existing single port-3100 test server, one worker, and fresh
browser/API contexts. No second server or CI changes were added. The manual
portal server is left alone. The reported passing subscription tests exercised
the enabled reset endpoint. Its absence during ordinary startup remains a code
review conclusion, not a separately reported HTTP check.

JavaScript syntax checking of the changed server and `npm run typecheck` passed;
`git diff --check` passed. User-reported automated evidence:

- The selected cancellation test passed in a visible Playwright debug run.
- `npm run test:headed` executed all ten Chromium tests: **10 passed**, one
  worker, total test-run duration **6.7 seconds**.

No separate local headless ten-test run is claimed. Hosted ten-test verification
passed as recorded in the CI section. These local results were supplied by the user and were not rerun
during the documentation update/code review. Historical results above and below
remain separate from this ten-test run.

## Continuous integration (CI)

The **Sign-in checks** GitHub Actions workflow runs on pull requests targeting
`main` and pushes to `main`. On Ubuntu with Node.js 24, it installs the locked
dependencies and Playwright Chromium with its system dependencies, then runs
strict TypeScript checking and the current Playwright suite. Failures remain
visible and fail the job.

Find results in the pull request's checks or the repository's **Actions** tab.
Open a workflow run to inspect step logs. Its **Artifacts** section provides the
`playwright-results` download, containing any generated `playwright-report/` and
`test-results/` files. Artifact upload is attempted even when earlier steps fail;
if no files were generated, no artifact is uploaded. Artifacts are retained for
7 days. Download and extract the artifact to inspect the HTML report and any
failure screenshots or traces.

The [first hosted run](https://github.com/noamgorelik/Projects/actions/runs/38677908439)
passed TypeScript checking. Both Chromium sign-in tests executed and passed,
using one worker. The run uploaded the `playwright-results` artifact.
No additional packages or secrets are needed.

The [hosted five-test run](https://github.com/noamgorelik/Projects/actions/runs/38832251247)
executed and passed all five Chromium tests with one worker. The test-run duration
was 2.9 seconds. The workflow succeeded and uploaded `playwright-results`.
The first hosted run above remains the historical two-test result.

The [hosted ten-test run](https://github.com/noamgorelik/Projects/actions/runs/38839765677)
executed and passed all ten Chromium tests with one worker. The test-run duration
was 4.4 seconds, not the whole workflow duration. This is separate from the
visible local ten-test run that passed in 6.7 seconds.
