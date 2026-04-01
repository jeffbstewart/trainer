-- Add auto-increment id to app_config for KEntity compatibility.
-- config_key remains unique but is no longer the PK.
ALTER TABLE app_config DROP PRIMARY KEY;
ALTER TABLE app_config ADD COLUMN id BIGINT AUTO_INCREMENT PRIMARY KEY;
ALTER TABLE app_config ADD CONSTRAINT uq_app_config_key UNIQUE (config_key);
