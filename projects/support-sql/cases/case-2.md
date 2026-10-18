# Case 2 — Cancellation reports success, but remains Active

**Fictional customer report; intentionally seeded lab defect.** Core reproduction,
SQL investigation, corrected-mode comparison, safe repetition, and restart
persistence were manually verified from user-observed evidence. This update did
not independently rerun them. Unperformed checks remain explicit below.

## Customer report and product rule

“I confirmed cancellation and saw a success message, but checking again still
shows my subscription as Active.”

Confirmed cancellation must change only the selected account's subscription to
Cancelled, agree with fresh lookup, safely support repetition, and persist after
lab restart without reset. Invalid confirmation must not change data.
`X-Lab-Account-Id` selects fictional fixture data; it is **not authentication**.
Missing/invalid context is intended to return 400; unknown accounts 404.

## Initial hypotheses versus proven cause

Initial hypotheses were a stale response, delayed processing, or a write that
matched no rows despite reporting success. They were possibilities, not findings.

The seeded POST returned success, but its correlated log reported zero changed
rows; a fresh GET still showed Active. SQL found Alice's stored subscription,
while the defective predicate matched no rows. Corrected mode changed the same
data without reset, and fresh API/SQL reads agreed after restart. Together with
code inspection, this establishes the wrong identifier predicate plus unchecked
success reporting as the intentionally seeded cause. This was not a display-only
issue or delayed cancellation worker.

Alice's account ID is 101 and subscription ID is 501. Bob's account ID is 102
and subscription ID is **502**, not 501; the user corrected that report typo.

## Reproduction and API/log evidence

Follow the lab README's exact reset/start commands, Postman fixture header and
JSON body, and bound SQL instructions. The verified sequence used seeded mode,
then corrected mode **without resetting**, then restarted corrected mode
**without resetting** again.

| Step | User-observed evidence |
| --- | --- |
| Seeded reset/start | Succeeded. |
| Alice baseline GET | 200; subscription 501, account 101, active. |
| Seeded cancellation POST | 200 with success message; correlated log `rowsChanged=0`. |
| Subsequent Alice GET | 200, still active. |
| SQL baseline | Alice 501/101/active; Bob 502/102/active. |
| Bound parameter | `account_id=101`. |
| SQL predicate `id = :account_id` | Zero matching rows. |
| SQL predicate `account_id = :account_id` | Found Alice's subscription 501. |
| Corrected cancellation, no reset | 200; `rowsChanged=1`. |
| Corrected Alice GET | 200; 501/101/cancelled. |
| Corrected Bob GET | 200; 502/102/active. |
| Repeated corrected cancellation | 200; `rowsChanged=1`; Alice stayed cancelled, Bob active. |
| Corrected restart, no reset | API and final SQL confirmed 501/101/cancelled and 502/102/active. |

No request IDs, timestamps, or raw transcripts were supplied; none are invented.
Only the seeded cancellation's log correlation was explicitly reported. Exact
repeated-response JSON comparison and health-response verification were not
reported, so the table does not imply those checks occurred.

## SQL investigation

Read-only file: `queries/case-2.sql`. It joins accounts to subscriptions and
compares the following predicates using the separately bound account ID:

```sql
SELECT id, account_id, plan, status FROM subscriptions WHERE id = :account_id;
SELECT id, account_id, plan, status FROM subscriptions WHERE account_id = :account_id;
```

The user bound 101. The first matched no subscription; the second found 501.
The seeded UPDATE uses `WHERE id = ?` but binds the ACCOUNT ID. Corrected mode
uses `WHERE account_id = ?`. SQL input remains separate from statement text.
No manual database repair was needed for the mode comparison.

`rowsChanged` is the actual server statement's `run().changes` result. It is not
inferred from HTTP status. SQLite `changes()` on a separate CLI connection cannot
show the server connection's earlier result. The repeated corrected UPDATE
reported 1 even though Alice was already Cancelled. That is **not a count of new
business events** and does not mean another cancellation occurred. Safe repetition
was supported by the observed success and unchanged Alice/Bob states.

## Resolution and verification

Corrected mode already contains the teaching correction: update by account
ownership and check that the statement reports exactly one row before success.
The user compared the two implementations against the same database. Alice
became Cancelled, Bob stayed Active, repetition was safe, and the final API/SQL
state persisted after restart without reset. This is a lab resolution for the
reported scenario, not a production deployment.

There is no verified workaround that makes seeded mode cancel successfully.
A success message alone is insufficient; verify the stored subscription before
telling the fictional customer that cancellation took effect.

## Internal engineering ticket

- **Title:** [Fictional Case 2] Cancellation returns success after updating zero rows.
- **Environment:** isolated lab, Case 2, port 3300, seeded/corrected modes.
  Execution-time versions and timestamps were not supplied.
- **Impact:** false cancellation confirmation while the stored subscription is Active.
- **Reproduction:** reset/start seeded mode; select account 101; GET, POST JSON
  `{"confirm":true}`, then fresh GET. Observed 200 success with rowsChanged=0
  followed by Active. See evidence table.
- **Root cause:** account ID compared to subscription ID; unchecked result
  permitted false success.
- **Correction:** ownership predicate with expected one-row outcome check.
- **Verification:** same database, corrected cancellation, fresh Alice/Bob GETs,
  safe repeat, and API/SQL persistence after restart. All user-observed.
- **Disposition:** manually verified teaching correction; no production rollout.

Acceptance criteria and verification limits:

- [x] Seeded success contradicts actual zero-row result and fresh Active lookup.
- [x] Bound SQL explains the identifier mismatch and finds the correct ownership row.
- [x] Corrected comparison uses the existing database without reset.
- [x] Corrected cancellation returns 200, reports rowsChanged=1, and stores Cancelled.
- [x] Bob's subscription 502/account 102 remains Active.
- [x] Repeated cancellation returns 200 and preserves Alice Cancelled/Bob Active.
- [x] Corrected restart without reset preserves both states in API and final SQL.
- [x] Seeded cancellation response was correlated with its rowsChanged log.
- [ ] Invalid confirmation leaves data unchanged: implemented, not reported exercised.
- [ ] Missing/invalid/unknown fixture-header responses: implemented, not reported exercised.
- [ ] Exact repeated-success JSON body comparison: not reported exercised.
- [ ] Unexpected-row 409 handling and operational failure paths: code-reviewed only.
- [ ] Full log-field/no-secret runtime audit: not reported; code does not log passwords
  or session identifiers.

## Customer response — fictional training example

“We confirmed that the original cancellation request showed success without
updating your subscription. The lab was using the account number where it
needed to match the subscription's account ownership. In the corrected lab
version, we verified that your subscription is Cancelled, remains Cancelled
after restarting the lab, and that another account was not changed. Repeating
the request also left the correct statuses intact. This was a fictional training
exercise, not a deployment to a live customer service.”

## Interview walkthrough and limits

Report → competing hypotheses → POST/log contradiction → bound SQL proof →
corrected ownership update → independent account checks → restart persistence
→ accurate engineering and customer communication.

Existing CI covers the completed portal UI/API, not this lab investigation.
There are no automated or hosted Case 2 results. SQLite execution is not MSSQL
verification. Cases 1 and 2 are manually verified; Case 3 remains planned.
