# Case 3 — My subscription shows someone else's cancellation

**Fictional customer report; intentionally seeded defect.** The core investigation
and teaching-correction comparison are manually verified from user observations.
Remaining unperformed checks are listed below. No independent rerun occurred
in this documentation update. All three planned support cases now have manual
verification; existing portal CI remains separate.

## Report and expected behavior

“I have not cancelled my subscription, but my account shows Cancelled.”

Alice owns subscription 501 and is Active; Bob owns subscription 502 and is
Cancelled. Each known account selection should return its own exact subscription
ID, owner ID, plan, and status. Unknown account 999 should return 404, never
someone else's row. Missing/invalid fixture headers should return 400.

`X-Lab-Account-Id` is a caller-controlled fixture selector, **not authentication**.
This is not a real customer incident, a verified authentication system, or
production security verification. No broader impact or real disclosure is claimed.

## Initial hypotheses versus proven cause

Initial possibilities: Alice's stored subscription had been cancelled, a stale
response showed the wrong value, or the query selected another account's row.
Those were hypotheses, not conclusions.

SQL showed Alice's own row still Active and Bob's row Cancelled. The highest-ID
query selected Bob; filtering by account 101 selected Alice. The seeded API
returned Bob's owner ID even for Alice's requested account, as confirmed in logs.
Corrected alternating requests returned each account's own row without reset,
and final SQL matched baseline. Together with code inspection, this establishes
the missing ownership filter as the cause: **row selection was wrong; Alice's
stored subscription had not actually been cancelled**.

## Reproduction and user-observed evidence

Use the lab README's reset/start commands, fixture headers, and numeric SQL
bindings. The reported comparison switched to corrected mode without resetting.

| Check | User-observed result |
| --- | --- |
| Seeded health | 200, case 3, seeded. |
| Seeded Alice request | 200; subscription 502/account 102/cancelled. |
| Seeded Alice log | requestedAccountId=101, returnedAccountId=102. |
| Seeded Bob request | 200; subscription 502/account 102/cancelled. |
| Seeded Bob log | requestedAccountId=102, returnedAccountId=102. |
| SQL JOIN baseline | Alice account 101/subscription 501/active; Bob account 102/subscription 502/cancelled. |
| Highest-ID SQL | Bob's 502/102/cancelled row. |
| Ownership-filtered SQL for 101 | Alice's 501/101/active row. |
| Corrected comparison | No database reset between modes. |
| Corrected sequence 101 → 102 → 101 → 102 | All four returned 200. Both Alice results were 501/101/active; both Bob results were 502/102/cancelled. |
| Corrected logs | Requested/returned account IDs matched. |
| Unknown account 999 | 404, account not found. |
| Final SQL | 501/101/active and 502/102/cancelled, unchanged from baseline. |

The unknown-account report did not establish seeded-mode coverage or an exact
error-JSON comparison. No request IDs, timestamps, transcripts, corrected health
response, or full log-field audit were supplied; none are invented here.

## SQL investigation

Saved read-only file: `queries/case-3.sql`. A JOIN combines accounts and their
subscriptions to establish actual ownership and stored status. The highest-ID
query intentionally ignores the selected account:

```sql
SELECT id, account_id, plan, status
FROM subscriptions
ORDER BY id DESC
LIMIT 1;
```

The corrected server query binds the selected account separately:

```sql
SELECT id, account_id, plan, status
FROM subscriptions
WHERE account_id = ?;
```

The saved CLI query uses named `:account_id`; numeric binding instructions are
in the lab README. For 101, the observed filtered query found Alice's own row.
No request input is interpolated into SQL. The unfiltered query needs no input
because it disregards ownership. Highest ID is neither an ownership rule nor
proof of cancellation timing.

## Teaching correction and meaningful verification

Corrected mode already contained the ownership-filtered implementation. The
user compared it with seeded mode on the same database, not as a new production
fix or deployment. Both handlers only SELECT; final SQL also confirmed the same
Alice Active/Bob Cancelled data. **No data repair was needed for this fixture.**

Alternating account selections established the correction independently for
Alice and Bob, rather than relying on Bob's already-correct seeded result.
Requested/returned IDs agreed in corrected logs. Unknown 999 was rejected in
the reported comparison, but both-mode coverage is not claimed.

## Internal engineering ticket

- **Title:** [Fictional Case 3] Subscription lookup omits account ownership filter.
- **Environment:** isolated support-sql Case 3, port 3300, seeded/corrected modes.
  Execution timestamps and versions were not supplied for this run.
- **Impact:** Alice's fixture selection displays Bob's cancellation and IDs.
  No real incident or reviewed production population is claimed.
- **Reproduction:** seeded GET with header 101, then 102. Both returned Bob's
  502/102/cancelled row; Alice's log showed requested 101 versus returned 102.
- **Expected:** Alice 501/101/active; Bob 502/102/cancelled; unknown 999 rejected.
- **Evidence:** API/log owner mismatch, joined SQL, highest-ID versus filtered
  selection, corrected alternation, and unchanged final SQL as summarized above.
- **Proven cause:** highest-ID selection lacks the account ownership predicate.
- **Teaching correction:** parameterized ownership filtering; no database repair.
- **Disposition:** manually verified for the reported comparison, not deployed
  to production. Remaining acceptance checks are explicitly unperformed below.

## Acceptance checklist and limits

- [x] Seeded Alice selection returns Bob's row; Bob selection returns his own row.
- [x] Reported logs distinguish requested and returned account IDs.
- [x] JOIN proves Alice Active/Bob Cancelled in stored data.
- [x] Highest-ID versus ownership-filtered SQL explains the mismatch for 101.
- [x] Corrected comparison uses the same database without reset.
- [x] Alternating Alice/Bob/Alice/Bob gives four 200 responses and the expected
  account/subscription/status tuples, with matching requested/returned account IDs.
- [x] Unknown account 999 returns 404, account not found, in the reported comparison.
- [x] Final SQL matches baseline; no data repair was needed.
- [ ] Unknown-account rejection specifically in seeded mode: not reported.
- [ ] Exact error-JSON comparison: not reported.
- [ ] Missing/invalid fixture-header 400 responses: implemented, not reported exercised.
- [ ] Corrected health payload, returned-subscription log field, result-count,
  request-ID correlation, and full no-secret log audit: no explicit observations supplied.

Code review of these remaining paths is not a claim of runtime execution.

## Plain-language customer response — fictional training example

“We confirmed that your saved subscription is still Active. The lab was showing
another account's Cancelled subscription because its lookup selected the wrong
row. In the corrected teaching version, we checked both accounts repeatedly:
yours showed Active and the other account showed its own Cancelled status.
The saved data was unchanged, so no subscription data repair was needed. This
was a fictional lab comparison, not a live customer incident or production
software deployment.”

## Interview walkthrough and boundaries

Report → competing hypotheses → requested/returned owner mismatch → SQL proof
of stored states → missing filter → corrected independent account checks →
unchanged data → engineering and customer communication.

Fixture selection is not authentication. No production security verification
is claimed. Existing CI covers the portal UI/API, not this lab investigation;
there are no automated or hosted lab results. SQLite execution does not
constitute MSSQL verification. This is the third and final planned case.
