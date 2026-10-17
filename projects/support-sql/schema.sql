CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
  plan TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled'))
);
