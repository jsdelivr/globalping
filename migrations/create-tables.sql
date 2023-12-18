CREATE TABLE IF NOT EXISTS adopted_probes (
  id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_created CHAR(36),
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_updated CHAR(36),
  date_updated TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  userId VARCHAR(255) NOT NULL,
  ip VARCHAR(255) NOT NULL,
  uuid VARCHAR(255),
  lastSyncDate DATE NOT NULL,
  isCustomCity TINYINT DEFAULT 0,
  tags LONGTEXT,
  status VARCHAR(255) NOT NULL,
  version VARCHAR(255) NOT NULL,
  country VARCHAR(255) NOT NULL,
  city VARCHAR(255),
  state VARCHAR(255),
  latitude FLOAT(10, 5),
  longitude FLOAT(10, 5),
  asn INTEGER NOT NULL,
  network VARCHAR(255) NOT NULL,
  countryOfCustomCity VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS directus_users (
  id CHAR(36),
  github VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS directus_notifications (
  id CHAR(10),
  recipient CHAR(36),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subject VARCHAR(255),
  message TEXT
);
