CREATE TABLE IF NOT EXISTS directus_users (
	id CHAR(36) PRIMARY KEY,
	github_username VARCHAR(255),
	github_organizations longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '[]' CHECK (json_valid(`github_organizations`)),
	user_type VARCHAR(255) NOT NULL DEFAULT 'member',
	public_probes BOOLEAN DEFAULT 0,
	adoption_token VARCHAR(255) NOT NULL,
	default_prefix VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gp_probes (
	id CHAR(36) PRIMARY KEY,
	name VARCHAR(255),
	date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	date_updated TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	userId VARCHAR(255),
	ip VARCHAR(255) NOT NULL,
	altIps LONGTEXT COLLATE utf8mb4_bin DEFAULT '[]' NOT NULL,
	uuid VARCHAR(255) NOT NULL,
	lastSyncDate DATE NOT NULL,
	tags LONGTEXT COLLATE utf8mb4_bin DEFAULT '[]' NOT NULL,
	systemTags LONGTEXT COLLATE utf8mb4_bin DEFAULT '[]' NOT NULL,
	status VARCHAR(255) NOT NULL,
	onlineTimesToday INT DEFAULT 0 NOT NULL,
	isIPv4Supported BOOLEAN DEFAULT 0 NOT NULL,
	isIPv6Supported BOOLEAN DEFAULT 0 NOT NULL,
	version VARCHAR(255) NOT NULL,
	nodeVersion VARCHAR(255) NOT NULL,
	hardwareDevice VARCHAR(255) NULL,
	hardwareDeviceFirmware VARCHAR(255) NULL,
	country VARCHAR(255) NOT NULL,
	countryName VARCHAR(255) NOT NULL,
	city VARCHAR(255) NOT NULL,
	state VARCHAR(255) NULL,
	stateName VARCHAR(255) NULL,
	continent VARCHAR(255) NOT NULL,
	continentName VARCHAR(255) NOT NULL,
	region VARCHAR(255) NOT NULL,
	latitude FLOAT(10, 5) NOT NULL,
	longitude FLOAT(10, 5) NOT NULL,
	asn INTEGER NOT NULL,
	network VARCHAR(255) NOT NULL,
	allowedCountries LONGTEXT COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`allowedCountries`)),
	originalLocation LONGTEXT COLLATE utf8mb4_bin NULL CHECK (json_valid(`originalLocation`)),
	customLocation LONGTEXT COLLATE utf8mb4_bin NULL CHECK (json_valid(`customLocation`)),
	searchIndex VARCHAR(4090) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS directus_notifications (
	id CHAR(10),
	recipient CHAR(36),
	timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	subject VARCHAR(255),
	message TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gp_tokens` (
	`date_created` timestamp NULL DEFAULT NULL,
	`date_last_used` date DEFAULT NULL,
	`date_updated` timestamp NULL DEFAULT NULL,
	`expire` date DEFAULT NULL,
	`id` int(10) unsigned NOT NULL AUTO_INCREMENT,
	`name` varchar(255) NOT NULL,
	`origins` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '[]' CHECK (json_valid(`origins`)),
	`user_created` char(36) DEFAULT NULL,
	`user_updated` char(36) DEFAULT NULL,
	`value` varchar(255) DEFAULT NULL,
	`scopes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '[]' CHECK (json_valid(`scopes`)),
	`type` varchar(255) DEFAULT 'access_token',
	`parent` int(10) unsigned DEFAULT NULL,
	PRIMARY KEY (`id`),
	UNIQUE KEY `gp_tokens_value_unique` (`value`),
	KEY `gp_tokens_user_created_foreign` (`user_created`),
	KEY `gp_tokens_user_updated_foreign` (`user_updated`),
	KEY `value_index` (`value`),
	KEY `gp_tokens_parent_foreign` (`parent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gp_credits (
	id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
	date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	AMOUNT INT,
	user_id VARCHAR(36) NOT NULL,
	CONSTRAINT gp_credits_user_id_unique UNIQUE (user_id),
	CONSTRAINT gp_credits_amount_positive CHECK (`amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
