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

This is a credential-validation demonstration, without persistent sessions or
production authentication. A successful response does not establish a logged-in
session. The single fictional account is hard-coded for practice; do not enter
real credentials. There is no database, subscription functionality, account
creation. Browser coverage is limited to the two sign-in scenarios.

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

`npm run test:headed` runs the same two tests with the browser visible.
The tests use labeled fields, call the actual API, and check its status, JSON,
and exact visible message. The error wording is “Email or password is incorrect.”

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

## Continuous integration (CI)

The **Sign-in checks** GitHub Actions workflow runs on pull requests targeting
`main` and pushes to `main`. On Ubuntu with Node.js 24, it installs the locked
dependencies and Playwright Chromium with its system dependencies, then runs
strict TypeScript checking and the existing two sign-in tests. Failures remain
visible and fail the job.

Find results in the pull request's checks or the repository's **Actions** tab.
Open a workflow run to inspect step logs. Its **Artifacts** section provides the
`playwright-results` download, containing any generated `playwright-report/` and
`test-results/` files. Artifact upload is attempted even when earlier steps fail;
if no files were generated, no artifact is uploaded. Artifacts are retained for
7 days. Download and extract the artifact to inspect the HTML report and any
failure screenshots or traces.

The workflow is added, but its first hosted run is still pending. No additional
packages or secrets are needed.
