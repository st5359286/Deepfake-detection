CREATE DATABASE IF NOT EXISTS project13_db;

USE project13_db;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE
);

-- Insert a sample user for testing. Password is 'password123'
INSERT INTO `users` (`username`, `password`, `email`) VALUES ('testuser', 'password123', 'test@example.com');