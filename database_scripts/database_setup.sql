-- User
DROP TABLE IF EXISTS app_user CASCADE;
CREATE TABLE app_user (
  ID SERIAL,
  email VARCHAR(256) UNIQUE NOT NULL CHECK (email <> ''),
  password_hash VARCHAR(64) NOT NULL CHECK (password_hash <> ''),
  first_name VARCHAR(64) NOT NULL CHECK (first_name <> ''),
  last_name VARCHAR(64) NOT NULL CHECK (last_name <> ''),
  PRIMARY KEY (ID)
);

-- Group
DROP TABLE IF EXISTS user_group CASCADE;
CREATE TABLE user_group (
  group_ID SERIAL PRIMARY KEY,
  group_name VARCHAR(64)
);