-- Read-only investigation. Bind :email in the CLI before reading this file.
SELECT :email AS supplied_email;

SELECT id, email FROM accounts WHERE email = :email;

-- Compare the space/case variant with the normalized lookup.
SELECT id, email FROM accounts WHERE lower(email) = lower(trim(:email));
