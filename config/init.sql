CREATE DATABASE IF NOT EXISTS directus;
USE directus;

CREATE TABLE IF NOT EXISTS adopted_probes (
  id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_created CHAR(36),
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_updated CHAR(36),
  date_updated TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  userId VARCHAR(255) NOT NULL,
  ip VARCHAR(255) NOT NULL,
  uuid VARCHAR(255),
  lastSyncDate DATE,
	isCustomCity TINYINT,
	tags LONGTEXT,
  status VARCHAR(255),
  version VARCHAR(255),
  country VARCHAR(255),
  city VARCHAR(255),
	latitude FLOAT,
	longitude FLOAT,
	asn INTEGER,
  network VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS directus_users (
  id CHAR(36),
  last_name VARCHAR(50)
);

INSERT IGNORE INTO adopted_probes (
	id,
	userId,
	lastSyncDate,
	ip,
	uuid,
	isCustomCity,
	country,
	city,
	latitude,
	longitude
) VALUES (
	'1',
	'1834071',
	CURRENT_DATE,
	'51.158.22.211',
	'',
	1,
	'FR',
	'Marseille',
	'43.29695',
	'5.38107'
);

INSERT IGNORE INTO directus_users (
	id,
	last_name
) VALUES (
	'1834071',
	'jimaek'
);
