-- User
DROP TABLE IF EXISTS app_user CASCADE;
CREATE TABLE app_user (
  ID SERIAL,
  email VARCHAR(256) UNIQUE NOT NULL CHECK (email <> ''),
  password_hash VARCHAR(64) NOT NULL CHECK (password_hash <> ''),
  PRIMARY KEY (ID)
);