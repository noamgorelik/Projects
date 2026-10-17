# Case 1 — Fictional account lookup failure

**Training fixture; intentionally seeded defect. Not a real customer incident.**
Status: core reproduction, investigation, and teaching-correction verification
completed manually, based on user-observed results. Unperformed checks remain
explicitly pending below. No independent rerun occurred during this update.

## Fictional customer report and product rule

“My saved email works, but my account cannot be found when I enter
ALICE@EXAMPLE.TEST or accidentally include spaces.”

For these fictional addresses, lookup must ignore email case and surrounding
whitespace. Supported Alice variants must return account 101 with stored email
`alice@example.test`. Unknown email returns 404; missing/empty email should return
400. The endpoint returns only account ID/email. This is a lab product rule,
not a claim about international email handling or an existing portal defect.

## Initial hypothesis versus proven cause

Initial hypothesis: Alice's account might be missing or deleted. Another
possibility was a difference between submitted and stored email formatting.

The user found Alice in SQLite. With uppercase input, the exact-match count
was 0, while normalized lookup returned Alice. Seeded HTTP lookup reproduced
the same difference; corrected mode returned the same account for the reported
variants without resetting the database. Together with the inspected lookup
code, this rejects the missing-account hypothesis and establishes the seeded
exact comparison as the cause of the reproduced case/space failures.

Seeded code binds the original input to `WHERE email = ?`. Corrected code
trims the input and binds it to `WHERE lower(email) = lower(?)`. Neither
interpolates request input into SQL. The correction was already present in
corrected mode for teaching: this was a comparison of lab implementations,
not a new production fix or deployment.

## Reproduction and API/log evidence

The user followed the reset/start workflow documented in the lab README,
then made requests to `/api/accounts/lookup`. Surrounding spaces were encoded
in the URL. The README provides Postman instructions for repeating the exercise.

| Step | User-observed result |
| --- | --- |
| Reset and start seeded mode | Both succeeded; health returned 200. |
| Seeded stored lowercase email | Returned Alice; one matching row. |
| Seeded uppercase email | HTTP 404; zero matching rows. |
| Seeded encoded surrounding spaces | HTTP 404. |
| Response/log correlation | Response request IDs were matched to terminal logs. |
| Switch to corrected mode | Switched without resetting the database. |
| Corrected lowercase email | HTTP 200, account 101, `alice@example.test`. |
| Corrected uppercase email | HTTP 200, account 101, `alice@example.test`. |
| Corrected surrounding spaces | HTTP 200, account 101, `alice@example.test`. |
| Combined `email=%20ALICE@example.test%20` | Seeded: 404. Corrected: 200, account 101, `alice@example.test`. |
| Unknown email | HTTP 404. |

These are summaries of user observations. Exact request IDs, timestamps,
health payload details, raw transcripts, and exact error JSON comparisons were
not supplied and are not fabricated here.

## SQL investigation

The user inspected SQLite and found Alice. For uppercase input, an exact-match
count of 0 contrasted with a normalized lookup returning Alice.

The saved read-only queries in `queries/case-1.sql` compare:

```sql
SELECT id, email FROM accounts WHERE email = :email;
SELECT id, email FROM accounts WHERE lower(email) = lower(trim(:email));
```

The reported count is evidence supplied by the user, not a claim that the saved
file contains a `COUNT` query. The first SELECT exposes matching rows; the
second removes ordinary surrounding spaces and normalizes case. `:email` is
bound separately using the CLI instructions in the README. These results prove
the account exists and explain why the exact lookup misses the uppercase value.

## Resolution/workaround and verification

Using the stored lowercase email without surrounding spaces worked in seeded
mode, providing a demonstrated temporary workaround.

Corrected-mode verification used the same database without resetting. The
reported lowercase, uppercase, and surrounding-space variants returned the same
exact Alice ID/email. Unknown email still returned 404. This supports the
teaching correction for the reproduced inputs, not every possible input or
failure condition. No reset occurred when switching modes; code review confirms
the lookup paths contain SELECTs only, rather than data-repair statements.

## Internal engineering ticket

- **Title:** [Fictional Lab Case 1] Exact email lookup rejects supported variants.
- **Environment:** isolated support-sql lab, Case 1, port 3300, seeded/corrected
  modes; setup checks recorded Node 24.21.0 and SQLite CLI 3.54.0.
- **Impact:** an existing fictional account appears missing when supported
  case/space variants are submitted.
- **Reproduction:** reset and start seeded mode; compare stored lowercase,
  uppercase, and encoded surrounding-space lookups. Use the same database
  when starting corrected mode. See API/log evidence above.
- **Expected/actual:** supported variants should identify Alice; seeded
  uppercase/spaces returned 404 while lowercase found her.
- **Evidence:** correlated HTTP/log request IDs, seeded row counts, SQLite
  account inspection, and exact-versus-normalized query results as summarized
  above. Raw identifiers/transcripts were not supplied.
- **Proven cause:** intentionally exact parameterized comparison misses the
  supported variants; Alice was not missing.
- **Teaching correction:** trim before binding to the case-normalized query.
- **Disposition:** verified for the reported variants in corrected lab mode;
  no production deployment claimed.

Acceptance criteria and evidence status:

- [x] Seeded lowercase succeeds; uppercase and encoded spaces reproduce failure.
- [x] SQLite establishes account existence and exact/normalized lookup difference.
- [x] Corrected mode is compared without resetting the database.
- [x] Corrected lowercase, uppercase, and surrounding-space requests return
  account 101 and `alice@example.test`.
- [x] Unknown email remains 404.
- [x] Response request IDs are correlated with terminal logs.
- [x] Combined `email=%20ALICE@example.test%20`: seeded 404; corrected 200
  with account 101, `alice@example.test` (user-observed).
- [ ] Bob's lookup: not reported.
- [ ] Missing, empty, and whitespace-only input returns controlled 400:
  implemented, but no runtime observation supplied.
- [ ] Exact error JSON, constraint rejection, reset-while-running, occupied
  port, missing database, and shutdown failure paths: no runtime evidence supplied.

## Customer response — fictional training example

“We confirmed that your account exists. The lab's lookup was treating capital
letters and surrounding spaces differently from your saved email. We compared
it with the corrected lab version using the same account data and verified
that lowercase, uppercase, and surrounding-space entries all find your account.
The saved lowercase address without surrounding spaces also works as a
temporary workaround in the original lab version. This was a training exercise;
we have not deployed a change to a live service.”

## Interview walkthrough and limits

Explain the report, initial missing-account hypothesis, visible requests,
correlated logs, SQL comparison, evidence-supported cause, corrected-mode
verification, and customer communication. State what was not checked.

Existing CI verifies the portal UI/API, not this lab. There are no automated
or hosted lab results. SQLite investigation is not MSSQL verification; no
SQL Server/T-SQL execution or collation behavior was tested. Cases 2/3 remain
planned and are not implemented here.

Hosted portal regression evidence supplied for this update (not lab automation):

- [API](https://github.com/noamgorelik/Projects/actions/runs/39079787829):
  12 passed, test-run duration 1.6 seconds.
- [UI](https://github.com/noamgorelik/Projects/actions/runs/39079787835):
  10 passed, test-run duration 5.5 seconds.

These are test-run durations, not whole workflow durations. Case 1 remains
manually verified from user observations, with no automated or hosted lab result.
