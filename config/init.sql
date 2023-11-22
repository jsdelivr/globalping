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

INSERT IGNORE INTO adopted_probes (
	userId,
	lastSyncDate,
	ip,
	uuid,
	isCustomCity,
	tags,
	status,
	version,
	country,
	city,
	latitude,
	longitude,
	network,
	asn,
	countryOfCustomCity
) VALUES (
	'89da69bd-a236-4ab7-9c5d-b5f52ce09959',
	CURRENT_DATE,
	'51.158.22.211',
	'c77f021d-23ff-440a-aa96-35e82c73e731',
	1,
	'["mytag1"]',
	'ready',
	'0.26.0',
	'FR',
	'Marseille',
	'43.29695',
	'5.38107',
	'SCALEWAY S.A.S.',
	12876,
	'FR'
);

INSERT IGNORE INTO directus_users (
	id,
	github
) VALUES (
	'89da69bd-a236-4ab7-9c5d-b5f52ce09959',
	'jimaek'
);
