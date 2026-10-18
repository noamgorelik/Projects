# Product Support and SQL Investigation Lab — Cases 1 and 2

This is an isolated fictional support exercise with an intentionally seeded
lookup defect. It is not a discovered defect in the completed Practice Portal.
Case 1 was manually verified using user-observed evidence recorded below.
Case 2 is also manually verified from user observations; Case 3 remains planned. This documentation update did not independently rerun those checks.

The lab uses existing Express and Node's built-in `node:sqlite`, with no new
dependencies. Setup capability checks found Node 24.21.0, an importable
`DatabaseSync`, and `/usr/bin/sqlite3` version 3.54.0. Importing the module did
not open a database. Syntax checks do not verify database or endpoint behavior.

## Data and boundaries

`schema.sql` defines two tables:

- `accounts`: `id` is the primary key (the row's unique identifier); `email` is
  required and unique.
- `subscriptions`: its own primary key `id`, a required unique `account_id`
  foreign key linking it to `accounts.id`, a required plan, and a required
  status restricted to `active` or `cancelled`. Each account can have one
  subscription. A foreign key prevents linking to a nonexistent account.

Every application database connection enables foreign-key enforcement.
`fixtures/case-1.sql` contains only fictional accounts: Alice (account 101,
subscription 501, `alice@example.test`) and Bob (account 102, subscription 502,
`bob@example.test`), both with Active Practice Plus subscriptions. Account and
subscription IDs deliberately differ. Case 1 only reads account ID/email.

The generated database is `data/lab.sqlite`. Its directory, including lock and
SQLite sidecar files, is ignored by Git; schema, fixtures, and investigation
queries are versioned. Unlike the portal's in-memory data, this file survives
lab restarts. Startup never seeds or resets it. Only an explicit reset restores
the Case 1 fixture. The portal, its sessions, Postman collection, tests, CI, and
dependencies are unchanged.

Case 1 retains its account-lookup endpoint. Case 2 adds only the subscription
lookup/cancellation investigation described below. Its `X-Lab-Account-Id` header
selects a fictional fixture account and is **not authentication**. There is no
frontend, payment processing, or Case 3 implementation. Bind address remains
`127.0.0.1:3300`; other portal/test ports are unrelated.

## First reset and seeded startup

Run these commands from the repository root, with the lab stopped:

```sh
cd /Users/ng/Developer/Projects
npm run support:reset -- --case=1
npm run support:start -- --case=1 --mode=seeded
```

Reset operates only on the fixed lab database path and uses a transaction: the
schema/data replacement is committed together, or rolled back on failure.
Server and reset use an exclusive `data/lab.lock`. Reset refuses to proceed
while the server owns the lock; stop the lab with Ctrl+C before resetting.
Startup fails clearly for a missing database or occupied port and never stops
another process. Normal Ctrl+C/SIGTERM shutdown closes the server/database and
releases its lock.

An abrupt crash or forced termination may leave a stale lock. Inspect the PID
in `data/lab.lock` and confirm no lab process or reset is still running before
manually removing only that lock file. Never delete a live lock to force reset.
If uncertain, leave it in place and investigate. Do not reset via the SQLite CLI.

## Visible Postman reproduction

Create temporary manual requests; no changes to the existing Postman collection
are required. Use Postman's Params tab so spaces are URL-encoded correctly.
Do not add passwords or session identifiers; this lookup requires none.

| Request | Expected behavior in seeded mode |
| --- | --- |
| `GET http://127.0.0.1:3300/health` | 200, identifies `support-sql`, case 1, and `seeded` mode. |
| `GET http://127.0.0.1:3300/api/accounts/lookup?email=alice@example.test` | 200, Alice. |
| Same lookup, Params `email` = `ALICE@EXAMPLE.TEST` | Intentional defect: 404. |
| Same lookup, Params `email` = `  alice@example.test  ` | Intentional defect: 404. |
| Same lookup, Params `email` = `  ALICE@EXAMPLE.TEST  ` | Intentional defect: 404. |
| Same lookup, Params `email` = `unknown@example.test` | Controlled 404. |
| Lookup with missing, empty, or whitespace-only `email` | Controlled 400. |

Response contracts from the implementation (the observed results and limits
are recorded below; not every error body was reported as checked):

```json
{"account":{"id":101,"email":"alice@example.test"}}
```

```json
{"error":"ACCOUNT_NOT_FOUND","message":"Account not found."}
```

```json
{"error":"INVALID_INPUT","message":"Provide a non-empty email."}
```

The health response is
`{"status":"ok","lab":"support-sql","case":1,"mode":"seeded"}`;
corrected startup changes only its `mode` field.

Watch the server terminal beside Postman. Every response has `X-Request-Id`;
match that ID to one structured JSON log containing case/mode, method/path,
lookup input, result count, and HTTP status. Non-lookup requests have null
lookup fields. Logs deliberately contain no password/session fields; enter
only fictional email values. Record actual IDs in your evidence notes only
after observing the requests. No runtime log examples are presented as evidence.

## Read-only SQL investigation

Leave the lab running and open a second terminal from the repository root:

```sh
sqlite3 -readonly -header -column projects/support-sql/data/lab.sqlite
```

The CLI is a separate read-only connection; enable foreign keys there too.
At its prompt, bind a value before loading the saved queries:

```text
PRAGMA foreign_keys = ON;
.parameter init
.parameter set :email "'  ALICE@EXAMPLE.TEST  '"
.parameter list
.read projects/support-sql/queries/case-1.sql
```

The outer double quotes group the CLI argument; the inner single quotes make
the value a SQL string literal, preserving its spaces. These are CLI instructions,
not commands to paste into a JavaScript string. Inspect `.parameter list` to
confirm the intended value. The saved SELECTs display the input, exact-match
result, and normalized result. Expected: zero exact matches versus Alice's row
after normalization; record what actually happens before drawing conclusions.

Repeat with:

```text
.parameter set :email "'alice@example.test'"
.read projects/support-sql/queries/case-1.sql
.parameter set :email "'unknown@example.test'"
.read projects/support-sql/queries/case-1.sql
.quit
```

A bound parameter supplies data separately from SQL text. Server statements
use `?` placeholders and never interpolate request input into SQL. The CLI
queries use a named `:email` parameter for the same reason. `SELECT` reads rows
without changing them. `lower` normalizes case; `trim` in the saved SQL removes
surrounding ordinary spaces. Corrected Node code uses JavaScript `trim()`
(which also removes surrounding tabs/newlines) before binding. The agreed
examples use ASCII fictional addresses; this is not a claim about every
international email/collation rule.

## Compare corrected mode using the same database

In the server terminal, press Ctrl+C. Do **not** reset. Then run:

```sh
npm run support:start -- --case=1 --mode=corrected
```

Repeat health, all supported email variants, Bob's lookup, unknown email, and
missing/empty input. Expected: all Alice variants return account 101 and the
stored lowercase email; Bob returns account 102; unknown stays 404; invalid
input stays 400. Compare request logs and rerun the read-only SQL with the same
parameters. Neither mode changes database data. Complete the case worksheet
only with actual evidence; stop your own lab server with Ctrl+C afterward.

## Evidence and completion limits

User-observed evidence supplied in this conversation:

- Reset and seeded startup succeeded; health returned 200.
- Seeded lowercase lookup returned Alice with one matching row. Uppercase
  returned 404 with zero matching rows. Encoded surrounding spaces also returned
  404. Response request IDs were matched to terminal logs.
- SQLite inspection found Alice. With uppercase input, the exact-match count
  was 0; normalized lookup returned Alice.
- The user switched to corrected mode **without resetting the database**.
  Lowercase, uppercase, and surrounding-space requests all returned 200 with
  account 101, `alice@example.test`. Unknown email returned 404.
- The combined input `email=%20ALICE@example.test%20` returned 404 in seeded
  mode and 200 with account 101, `alice@example.test`, in corrected mode.

These observations establish that the intentionally exact comparison, rather
than a missing Alice account, caused the reproduced failures. Corrected mode
already contains the teaching correction: trim input before binding it to the
case-normalized query. This was a comparison of seeded/corrected lab
implementations against the same database, not a production deployment.

See [cases/case-1.md](cases/case-1.md) for the completed report, evidence summary,
engineering ticket, customer response, and verification checklist. No request
IDs, timestamps, or raw transcripts were supplied, so none have been invented.
Bob's lookup, missing/empty input, error body
contracts, and operational failure paths remain unreported runtime checks.
Constraint enforcement and locking/cleanup were reviewed in code; they have
not been independently fault-tested here. Mode switching does not by itself
prove every shutdown failure path works.

Existing CI covers the completed portal UI/API projects, **not this support-lab
investigation**. No automated lab or hosted lab verification is claimed.

Hosted **portal regression** results supplied for this update:

- [API run](https://github.com/noamgorelik/Projects/actions/runs/39079787829):
  12 passed; test-run duration 1.6 seconds.
- [UI run](https://github.com/noamgorelik/Projects/actions/runs/39079787835):
  10 passed; test-run duration 5.5 seconds.

These durations measure test runs, not whole workflows. These portal checks
are separate from the manually verified lab and do not automate its investigation.

This exercise uses SQLite. SQLite execution does **not** constitute Microsoft
SQL Server (MSSQL) verification. No MSSQL instance, SQL Server collation behavior,
or T-SQL compatibility has been tested.


## Case 2 — cancellation reports success but remains Active

**Fictional customer report and intentionally seeded defect. Case 2 is manually
verified for the supplied observations below.** See [cases/case-2.md](cases/case-2.md)
for the completed investigation, ticket, acceptance checklist, and customer response. Case 1's recorded
results above remain unchanged and do not verify Case 2.

Stop your lab server before explicitly resetting the shared lab database:

```sh
npm run support:reset -- --case=2
npm run support:start -- --case=2 --mode=seeded
```

The reset selector uses an explicit fixture-file allowlist for cases 1 and 2;
request/command input is never used to construct a fixture path. The schema,
database location, exclusive lock, transaction/reset rules, local port 3300,
and shutdown behavior are unchanged. Startup never resets the database. The
Case 2 fixture contains Alice (account 101/subscription 501) and Bob (account
102/subscription 502), both Active on Practice Plus. Only one selected case runs
at a time. A reset intentionally replaces lab fixtures, so do not reset when
comparing seeded and corrected mode.

### Postman requests and response contracts

Use `http://127.0.0.1:3300` with header `X-Lab-Account-Id: 101` for Alice, or
`102` for Bob. This is a fixture selector, **not a login, session, or authorization
boundary**. Do not send passwords or session IDs. A positive safe integer is
required: missing/invalid IDs return 400 with
`{"error":"INVALID_ACCOUNT_CONTEXT","message":"Provide X-Lab-Account-Id as a positive integer."}`.
Unknown account IDs return 404 with
`{"error":"ACCOUNT_NOT_FOUND","message":"Account not found."}`.

- `GET /health`: 200 identifies lab, case 2, and selected mode.
- `GET /api/subscription`: 200 with
  `{"subscription":{"id":501,"account_id":101,"plan":"Practice Plus","status":"active"}}`
  for Alice initially; after corrected cancellation the status is `"cancelled"`.
  Bob's response uses IDs 502/102.
- `POST /api/subscription/cancel`: set `Content-Type: application/json`,
  `X-Lab-Account-Id: 101`, and raw JSON body `{"confirm":true}`.
  Successful response is 200 with `{"message":"Subscription cancelled."}`.
  Seeded mode deliberately returns this despite changing zero rows with these
  fixtures. Corrected mode requires the statement to report exactly one row;
  otherwise it returns 409 with `error: "CANCELLATION_NOT_APPLIED"` and message
  `"Expected to update exactly one subscription. Cancellation was not confirmed."`.
- Missing/invalid confirmation (for example `{"confirm":false}`) returns 400 with
  `{"error":"INVALID_CONFIRMATION","message":"Send JSON with confirm set to true to cancel your subscription."}`.
  No cancellation statement executes. Malformed JSON returns a controlled 400
  `INVALID_JSON` error. A known account without a subscription returns 404
  `SUBSCRIPTION_NOT_FOUND` on lookup; the supplied fixtures both have subscriptions.

The server selects the account before checking cancellation confirmation.
Input is always bound separately from SQL. There is no database-repair endpoint.

### Repeatable investigation and verification instructions

1. Reset/start Case 2 seeded mode. Verify health. GET Alice and Bob as baselines.
2. POST invalid confirmation for Alice; expect 400, then GET both accounts to
   check they remain Active. Also inspect missing/invalid/unknown ID handling.
3. POST confirmed cancellation for Alice. Observe seeded 200, then GET Alice
   again: expected Active. Correlate `X-Request-Id` with the terminal log.
4. Inspect structured logs: `case`, `mode`, `accountId`, `status`, and
   `rowsChanged`. Cancellation logs take `rowsChanged` directly from
   `StatementSync.run().changes`, not from HTTP status. Expected seeded value is
   0, but record the actual observation. Non-update requests leave it null.
5. In another terminal open the database read-only and bind Alice's account ID:

   ```sh
   sqlite3 -readonly -header -column projects/support-sql/data/lab.sqlite
   ```

   At its prompt:

   ```text
   PRAGMA foreign_keys = ON;
   .parameter init
   .parameter set :account_id 101
   .parameter list
   .read projects/support-sql/queries/case-2.sql
   ```

   The saved SELECTs compare `id = :account_id` (defective update predicate)
   with `account_id = :account_id` (ownership predicate). Expected: subscription
   501 belongs to account 101; the former matches no row, the latter one row.
   The joined listing shows both accounts and their stored statuses. Repeat
   with `.parameter set :account_id 102` to inspect Bob. Do not execute UPDATE
   statements in the CLI or repair the data manually.
6. SQLite `changes()` is connection-local: the CLI's connection cannot report
   the server connection's previous update. Use the correlated server
   `rowsChanged` log for that statement, then SELECT stored state separately.
   Repeating an update that already sets Cancelled may still report one matched
   row; it does not imply another cancellation or a new state transition.
7. Stop seeded mode with Ctrl+C and **do not reset**. Start:

   ```sh
   npm run support:start -- --case=2 --mode=corrected
   ```

   Confirm health mode, POST confirmed cancellation, inspect actual rowsChanged
   (expected 1), then make a fresh GET: Alice should be Cancelled. Repeat the
   confirmed POST and verify the same success JSON and stored Cancelled state.
   GET Bob and rerun the read-only listing: he should remain Active.
8. Stop/restart corrected mode using the same command, **without resetting**.
   Fresh lookup and SQL should still show Alice Cancelled and Bob Active.
   SQLite state survives process restart. Record this as evidence only after
   performing it. Close the CLI with `.quit` when finished.

Corrected mode already contains the teaching correction; comparing modes is
not a production deployment. Existing portal CI does not investigate this lab.
SQLite execution does not constitute MSSQL verification. Implementation setup
used static checks only. The following runtime evidence was subsequently
supplied by the user; this documentation review did not rerun it.

### Case 2 user-observed evidence

- Seeded reset/start succeeded. Alice GET returned 200 with subscription 501,
  account 101, Active. Confirmed cancellation returned 200 with the success
  message while the correlated log reported `rowsChanged=0`; a subsequent GET
  returned 200 and still Active.
- SQL showed Alice 501/101/active and Bob 502/102/active. With bound
  `account_id=101`, `WHERE id = :account_id` matched zero rows;
  `WHERE account_id = :account_id` found Alice's subscription 501.
- Corrected mode was started without resetting. Cancellation returned 200 with
  `rowsChanged=1`; Alice GET returned 200 with 501/101/cancelled, and Bob GET
  returned 200 with 502/102/active.
- Repeated confirmed cancellation returned 200 with `rowsChanged=1`. Alice
  stayed Cancelled; Bob stayed Active. The repeated-update count is not a count
  of new business events: it does not mean a second cancellation occurred.
- After restarting corrected mode without reset, API and final SQL confirmed
  Alice 501/101/cancelled and Bob 502/102/active.

Bob's subscription ID is **502**, not 501; the user corrected that report typo.
The account/subscription ID distinction is central to the diagnosis. These
observations establish the wrong UPDATE predicate and false-success handling
as the intentionally seeded cause, rather than a stale GET or delayed worker.
Corrected mode already contained the teaching correction; this comparison was
not a production deployment or manual database repair.

No exact request IDs, timestamps, raw transcripts, repeated-response body
comparison, health payload, invalid-confirmation/header checks, or operational
failure tests were supplied. Those checks remain unverified at runtime. Existing
CI covers portal UI/API, not this lab investigation; no automated or hosted lab
verification is claimed.
