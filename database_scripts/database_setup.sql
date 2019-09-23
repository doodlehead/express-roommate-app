-- User
DROP TABLE IF EXISTS app_user CASCADE;
CREATE TABLE app_user (
  user_ID SERIAL PRIMARY KEY,
  email VARCHAR(256) UNIQUE NOT NULL CHECK (email <> ''),
  password_hash VARCHAR(64) NOT NULL CHECK (password_hash <> ''),
  first_name VARCHAR(64) NOT NULL CHECK (first_name <> ''),
  last_name VARCHAR(64) NOT NULL CHECK (last_name <> '')
);

-- Group
DROP TABLE IF EXISTS user_group CASCADE;
CREATE TABLE user_group (
  group_ID SERIAL PRIMARY KEY,
  group_name VARCHAR(64) NOT NULL CHECK (group_name <> ''),
  group_admin INT REFERENCES app_user(user_ID) NOT NULL
);
-- BelongsTo: Users belong to groups
DROP TABLE IF EXISTS belongs_to CASCADE;
CREATE TABLE belongs_to (
  user_ID INT REFERENCES app_user(user_ID),
  group_ID INT REFERENCES user_group(group_ID),
  PRIMARY KEY (user_ID, group_ID)
)

