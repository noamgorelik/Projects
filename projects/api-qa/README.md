# Practice Portal API QA

This project uses Postman's native YAML collection under
`postman/collections/Practice Portal API QA/`. Keep its structure intact:
the hidden `.resources/definition.yaml` contains collection metadata and the
`baseUrl` variable, and `.postman/resources.yaml` maps the local collection to
its Postman workspace/cloud resource. Preserve both when reopening the project
through Native Git. `postman/globals/workspace.globals.yaml` currently has no
variables. The saved collection base URL is `http://127.0.0.1:3000`.

## Scope and order

The collection contains 17 ordered requests covering 12 agreed scenarios:

1. Server health.
2. Incorrect sign-in password.
3. Missing sign-in password.
4. Malformed sign-in JSON.
5. Account lookup without a session.
6. Subscription lookup without a session.
7. Cancellation without a session.
8. Successful sign-in and authenticated account lookup.
9. Active subscription lookup.
10. Rejected unconfirmed cancellation, followed by checking it is still Active.
11. Confirmed cancellation, stored Cancelled status, and repeated confirmation.
12. Sign-out and rejection of the saved old session.

Request `order` metadata defines execution order, not alphabetical filenames.
Expected negative responses include 400 (invalid input) and 401 (unauthenticated
or incorrect credentials). Assertions pass when those responses match the
expected status and JSON; an expected error response is not a failed test.

## Complete manual run

1. Before every complete run, restart the local portal server you own. From
   the repository root, stop that server with Ctrl+C and start it with
   `npm start`. Do not stop unrelated processes. Restart restores the fictional
   subscription to Active and clears server sessions.
2. Open the native collection in Postman and confirm the collection variable
   `baseUrl` resolves to `http://127.0.0.1:3000` without an unintended override.
3. Run one iteration of all 17 requests in their saved order. Do not manually
   send other requests between the restart and the collection run.
4. Review the request statuses, assertions, and script errors separately.

The collection cancels the subscription and does not reset it itself, so restart
again before another complete run. All accounts and subscription data are
fictional; there are no payments or database changes.

Successful sign-in temporarily captures the session cookie in the runtime
collection variable `sessionBeforeLogout`. The final replay request supplies
it explicitly with the cookie jar disabled, checks rejection after logout, and
unsets the variable. No actual session identifier belongs in these files or
reports. If a run is interrupted before replay, cleanup may not occur; remove
the temporary runtime variable before retrying. Server restart invalidates old
sessions regardless of runtime-variable cleanup.

## Evidence and limits

The updated user-observed complete Postman run executed 17 requests and passed
all 36 assertions, with zero failures or script errors. This is user-reported
evidence, not an independently rerun result.

The user-reported first automated API run passed all 12 tests. No execution
duration was supplied. Hosted API and UI regression verification passed as
recorded in the CI section below.
Existing UI automation and its historical results
are separate from this API project. The automated tests use Playwright directly;
they do not execute or convert the native Postman YAML. This native collection
is not claimed to work directly with Newman.

## Automated API suite

From the repository root:

```sh
npm run typecheck
npm run test:api
```

`test:api` uses `projects/api-qa/playwright.config.ts`, which selects only the
API tests. It uses the already-installed Playwright package with no browser or
page fixtures, one worker, and no retries. No browser installation is needed
for this API suite. The first passing execution was reported by the user;
it has not been independently rerun during this documentation update/review.

The 12 independent tests in `tests/api.spec.ts` map to the agreed scenarios:

| Test | Scenario and checks |
| --- | --- |
| 1 | Health: 200 and exact status JSON. |
| 2 | Correct login: 200, exact account/message JSON, and session cookie attributes. |
| 3 | Incorrect password: 401 and exact credentials error. |
| 4 | Missing password: 400 and exact input error. |
| 5 | Malformed JSON: 400 and exact parsing error. |
| 6 | Account without a session: 401 and exact authentication error. |
| 7 | Account with a valid session: 200 and exact account JSON. |
| 8 | Unauthenticated subscription lookup and cancellation: both exact 401 responses. |
| 9 | Authenticated subscription lookup: 200 and exact Active subscription. |
| 10 | Confirmation false: exact 400 response; a subsequent GET proves Active. |
| 11 | Confirmed cancellation: exact 200 response, stored Cancelled state, and the same successful repeated response. |
| 12 | Logout: 204, empty body, cookie removed, and explicit old-cookie replay rejected with exact 401 JSON. |

Some manual scenarios span multiple Postman requests; each automated test
establishes its own prerequisites rather than depending on a previous test.
Each test receives a fresh API request context (an HTTP client with its own
cookie jar). Before every test, it calls the existing guarded reset endpoint
and asserts 204 to restore the shared subscription to Active. Tests that need
authentication sign in independently. Session identifiers remain in memory;
they are not logged or explicitly attached, and storage state is not written
to disk. There are no mocks, arbitrary delays, or shared authenticated state.

| Port | Purpose |
| --- | --- |
| 3000 | Manual portal and saved Postman `baseUrl`; restart before each complete manual collection run. |
| 3100 | Existing UI Playwright suite, unchanged. |
| 3200 | Dedicated API test-managed server with its own in-memory state. |

The API configuration starts `npm start` from the repository root, sets
`PORT=3200` and `PRACTICE_TEST_RESET=1` in that server's environment, and waits
for `http://127.0.0.1:3200/health`. It refuses to reuse an existing server and
does not stop unrelated processes. The flag is not added to ordinary startup;
the existing UI configuration remains unchanged. Manual runs still need their
restart prerequisite because they do not use the test-only reset.

API results are written to the existing ignored `test-results/api/` folder;
the HTML report is written to `playwright-report/api/` without opening it
automatically. After a run, inspect it with
`npx playwright show-report playwright-report/api`. These generated reports
are temporary and separate from the UI report paths.

Type checking and whitespace validation passed during setup. The first API run
passed all 12 tests according to the user; no duration is recorded. No request
or browser tests were rerun during the CI/documentation update.

## API continuous integration

The **API checks** workflow runs on pull requests targeting `main` and pushes to
`main`. It installs locked dependencies on Ubuntu with Node.js 24, runs the
shared type check, and runs `npm run test:api`. No browser installation is needed.
Results will appear in pull request checks and the repository's Actions tab.
The workflow attempts to upload `playwright-report/api/` and `test-results/api/`
even after a failed step, as the `api-results` artifact retained for seven days.
Missing report files are ignored.

Verified hosted results supplied for this update:

- [API run](https://github.com/noamgorelik/Projects/actions/runs/39051954118):
  12 tests passed; test-run duration **1.5 seconds**. The workflow succeeded
  and uploaded `api-results`.
- [UI regression run](https://github.com/noamgorelik/Projects/actions/runs/39051954062):
  10 tests passed; test-run duration **4.3 seconds**. The workflow succeeded
  and uploaded `playwright-results`.

These are test-run durations, not whole workflow durations. They are separate
from the local API result, Postman evidence, and historical UI results. No tests
were rerun during this documentation update.
