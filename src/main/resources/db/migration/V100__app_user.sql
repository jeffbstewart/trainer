CREATE TABLE app_user (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(200) NOT NULL,
    access_level    INTEGER NOT NULL DEFAULT 1,
    locked          BOOLEAN NOT NULL DEFAULT FALSE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_config (
    config_key      VARCHAR(100) PRIMARY KEY,
    config_val      VARCHAR(4000) NOT NULL
);
