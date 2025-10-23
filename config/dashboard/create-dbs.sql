CREATE DATABASE IF NOT EXISTS `dashboard-globalping`;
GRANT ALL PRIVILEGES ON `dashboard-globalping`.* to 'directus'@'%';

CREATE DATABASE IF NOT EXISTS `dashboard-globalping-test`;
GRANT ALL PRIVILEGES ON `dashboard-globalping-test`.* to 'directus'@'%';

-- Directus issue https://github.com/directus/directus/discussions/11786
ALTER DATABASE `dashboard-globalping` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER DATABASE `dashboard-globalping-test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
