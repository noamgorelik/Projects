-- Read-only investigation. Bind :account_id to 101, then 102, then 999.
SELECT :account_id AS requested_account_id;

SELECT a.id AS account_id, a.email, s.id AS subscription_id, s.plan, s.status
FROM accounts AS a
JOIN subscriptions AS s ON s.account_id = a.id
ORDER BY a.id;

-- Seeded lookup: returns the highest ID irrespective of the selected owner.
SELECT id, account_id, plan, status
FROM subscriptions
ORDER BY id DESC
LIMIT 1;

-- Corrected lookup: binds the selected account ID to its ownership column.
SELECT id, account_id, plan, status
FROM subscriptions
WHERE account_id = :account_id;
