# QA Automation and Product Support Portfolio

This beginner-friendly portfolio aims to demonstrate balanced QA automation and
product support skills through small, practical projects.

## Planned projects

- **UI QA:** Check user-facing flows and build automated browser tests.
- **API testing:** Check requests, responses, and error handling.
- **Support investigations:** Investigate practice issues and document findings
  and clear customer-facing explanations.

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
credentials. There is no database, subscription functionality, or account
creation. Browser coverage includes five scenarios: correct and incorrect sign-in,
refresh persistence, sign-out invalidation, and unauthenticated account access.
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

`npm run test:headed` runs the same five tests with the browser visible.
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
