CREATE DATABASE IF NOT EXISTS directus;
GRANT ALL PRIVILEGES ON directus.* to 'directus'@'%';

CREATE DATABASE IF NOT EXISTS `directus-test`;
GRANT ALL PRIVILEGES ON `directus-test`.* to 'directus'@'%';
