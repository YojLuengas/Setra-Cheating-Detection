-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 22, 2025 at 07:39 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sentra_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `detections`
--

CREATE TABLE `detections` (
  `id` varchar(36) NOT NULL,
  `timestamp` datetime DEFAULT NULL,
  `epoch` double DEFAULT NULL,
  `image` longblob DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','user') DEFAULT 'user',
  `name` varchar(100) DEFAULT NULL,
  `status` enum('Active','Inactive','Locked') DEFAULT 'Active',
  `created_by` varchar(100) DEFAULT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `role`, `name`, `status`, `created_by`, `updated_by`, `created_at`, `updated_at`) VALUES
(1, 'admin', '$2b$12$o9FOK1jKkV/O/vz4vmcehu8x/Epv3G36bQTTirsyZ/QLM7Ek8rQha', 'admin', NULL, 'Active', NULL, NULL, '2025-09-21 13:26:10', '2025-09-21 13:26:10'),
(2, 'Ara', '$2b$12$u8lyB3a6zi5uBL3g.6rLTud04S5Xh3FeskTVO/SsUDVltbh0rxRMC', 'user', NULL, 'Active', NULL, 'admin', '2025-09-21 13:26:10', '2025-09-21 13:59:45'),
(3, 'marken', '$2b$12$rPocvuZ0Bu3l/dWld5ANTua2/Ucan4AuhWiE4A3DzLCAeW4adj6Yi', 'user', NULL, 'Active', NULL, 'admin', '2025-09-21 13:26:10', '2025-09-21 13:59:47'),
(4, 'Jomar23', '$2b$12$Tx/vyWKq5G7bDeQ8eDQeuem0D2fMjMmVo24CvXBZBRWdIF32sEU8O', 'user', 'Jomar', 'Active', 'admin', 'admin', '2025-09-21 13:41:37', '2025-09-21 13:59:39');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `detections`
--
ALTER TABLE `detections`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
