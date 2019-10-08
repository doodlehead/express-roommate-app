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
);

-- Calendar
DROP TABLE IF EXISTS calendar CASCADE;
CREATE TABLE calendar (
  calendar_ID SERIAL PRIMARY KEY,
  user_ID INT REFERENCES app_user(user_ID) NOT NULL,
  calendar_name VARCHAR(64) NOT NULL CHECK (calendar_name <> '')
);
-- Event importance enum
DROP TYPE IF EXISTS importance;
CREATE TYPE importance AS ENUM ('trivial', 'minor', 'major', 'critical');

-- Calendar Event
DROP TABLE IF EXISTS calendar_event CASCADE;
CREATE TABLE calendar_event (
  event_ID SERIAL PRIMARY KEY,
  event_name VARCHAR(64),
  calendar_ID INT REFERENCES calendar(calendar_ID) NOT NULL,
  start_time TIME(0) NOT NULL,
  end_time TIME(0) NOT NULL,
  start_date DATE,
  end_date DATE,
  recurring BOOLEAN,
  description VARCHAR(200),
  event_importance importance NOT NULL,

  constraint recurring_check CHECK
  (
    recurring = TRUE
    OR (start_date IS NOT NULL AND end_date IS NOT NULL)
  )
);
