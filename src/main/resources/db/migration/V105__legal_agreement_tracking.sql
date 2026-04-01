-- Track which version of legal documents each user has agreed to
ALTER TABLE app_user ADD COLUMN privacy_policy_version INT;
ALTER TABLE app_user ADD COLUMN privacy_policy_agreed_at TIMESTAMP;
ALTER TABLE app_user ADD COLUMN terms_of_use_version INT;
ALTER TABLE app_user ADD COLUMN terms_of_use_agreed_at TIMESTAMP;
