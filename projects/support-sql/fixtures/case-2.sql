-- Fictional Case 2 fixtures. Account IDs deliberately differ from subscription IDs.
INSERT INTO accounts (id, email) VALUES
  (101, 'alice@example.test'),
  (102, 'bob@example.test');

INSERT INTO subscriptions (id, account_id, plan, status) VALUES
  (501, 101, 'Practice Plus', 'active'),
  (502, 102, 'Practice Plus', 'active');
