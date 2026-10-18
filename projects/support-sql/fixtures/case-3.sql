-- Fictional Case 3 data. Different statuses expose the intentional read defect.
INSERT INTO accounts (id, email) VALUES
  (101, 'alice@example.test'),
  (102, 'bob@example.test');

INSERT INTO subscriptions (id, account_id, plan, status) VALUES
  (501, 101, 'Practice Plus', 'active'),
  (502, 102, 'Practice Plus', 'cancelled');
