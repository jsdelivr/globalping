CREATE TABLE IF NOT EXISTS directus_users (
  id CHAR(36),
  github_username VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS gp_adopted_probes (
  id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_created CHAR(36),
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_updated CHAR(36),
  date_updated TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  userId VARCHAR(255) NOT NULL,
  ip VARCHAR(255) NOT NULL,
  uuid VARCHAR(255),
  lastSyncDate DATE NOT NULL,
  isCustomCity TINYINT(1) DEFAULT 0,
  tags LONGTEXT,
  status VARCHAR(255) NOT NULL,
  isIPv4Supported BOOLEAN,
  isIPv6Supported BOOLEAN,
  version VARCHAR(255) NOT NULL,
  nodeVersion VARCHAR(255) NOT NULL,
  hardwareDevice VARCHAR(255) NULL,
  country VARCHAR(255) NOT NULL,
  city VARCHAR(255),
  state VARCHAR(255),
  latitude FLOAT(10, 5),
  longitude FLOAT(10, 5),
  asn INTEGER NOT NULL,
  network VARCHAR(255) NOT NULL,
  countryOfCustomCity VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS directus_notifications (
  id CHAR(10),
  recipient CHAR(36),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subject VARCHAR(255),
  message TEXT
);

CREATE TABLE IF NOT EXISTS gp_tokens (
  id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
	user_created CHAR(36),
	name VARCHAR(255),
	value VARCHAR(255),
	origins LONGTEXT,
	expire DATE,
	date_last_used DATE
);

CREATE TABLE IF NOT EXISTS gp_credits (
  id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	AMOUNT INT,
	user_id VARCHAR(36) NOT NULL,
	CONSTRAINT gp_credits_user_id_unique UNIQUE (user_id),
	CONSTRAINT gp_credits_amount_positive CHECK (`amount` >= 0)
);

CREATE TABLE IF NOT EXISTS gp_location_overrides (
  id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_created CHAR(36),
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_updated CHAR(36),
  date_updated TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ip_range VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  state VARCHAR(255),
  country VARCHAR(255),
	latitude FLOAT(10, 5),
	longitude FLOAT(10, 5)
);
