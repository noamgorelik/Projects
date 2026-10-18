-- Read-only investigation: bind :account_id in the SQLite CLI before .read.
SELECT :account_id AS selected_account_id;

SELECT a.id AS account_id, a.email, s.id AS subscription_id, s.plan, s.status
FROM accounts AS a
JOIN subscriptions AS s ON s.account_id = a.id
ORDER BY a.id;

-- Seeded UPDATE uses this predicate: no row matches for account 101 or 102.
SELECT id, account_id, plan, status FROM subscriptions WHERE id = :account_id;

-- Corrected UPDATE uses the ownership predicate: one matching subscription.
SELECT id, account_id, plan, status FROM subscriptions WHERE account_id = :account_id;

-- Do NOT use changes() here to infer what the server's separate connection did.
-- Read the server's actual StatementSync.run().changes result in request logs.
