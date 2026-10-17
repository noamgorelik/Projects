# Product Support and SQL Investigation Lab — Case 1

This is an isolated fictional support exercise with an intentionally seeded
lookup defect. It is not a discovered defect in the completed Practice Portal.
Only the shared foundation and Case 1 are implemented. Case 1 was manually
verified using user-observed evidence recorded below; Cases 2 and 3 remain
planned. This documentation update did not independently rerun those checks.

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

Fixture identity headers belong to later subscription cases. No authentication,
identity-header handling, subscription endpoints, frontend, or Cases 2/3 are
added here. Bind address is fixed to `127.0.0.1:3300`; other portal/test ports
are unrelated.

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

These observations establish that the intentionally exact comparison, rather
than a missing Alice account, caused the reproduced failures. Corrected mode
already contains the teaching correction: trim input before binding it to the
case-normalized query. This was a comparison of seeded/corrected lab
implementations against the same database, not a production deployment.

See [cases/case-1.md](cases/case-1.md) for the completed report, evidence summary,
engineering ticket, customer response, and verification checklist. No request
IDs, timestamps, or raw transcripts were supplied, so none have been invented.
Bob's lookup, combined case-plus-space input, missing/empty input, error body
contracts, and operational failure paths remain unreported runtime checks.
Constraint enforcement and locking/cleanup were reviewed in code; they have
not been independently fault-tested here. Mode switching does not by itself
prove every shutdown failure path works.

Existing CI covers the completed portal UI/API projects, **not this support-lab
investigation**. No automated lab or hosted lab verification is claimed.

This exercise uses SQLite. SQLite execution does **not** constitute Microsoft
SQL Server (MSSQL) verification. No MSSQL instance, SQL Server collation behavior,
or T-SQL compatibility has been tested.
