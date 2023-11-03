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

INSERT IGNORE INTO adopted_probes (id, userId, ip) VALUES ('1', '6191378', '79.205.97.254');
INSERT IGNORE INTO directus_users (id, last_name) VALUES ('9981f785-d216-4358-a4d0-b71e54986199', '6191378');
