-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 20, 2025 at 04:26 PM
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
-- Table structure for table `assessment_sessions`
--

CREATE TABLE `assessment_sessions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course` varchar(255) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `exam_type` varchar(255) DEFAULT NULL,
  `exam_datetime` datetime DEFAULT NULL,
  `camera` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `assessment_sessions`
--

INSERT INTO `assessment_sessions` (`id`, `user_id`, `course`, `subject`, `exam_type`, `exam_datetime`, `camera`, `created_at`) VALUES
(287, 4, 'BSIT-1A', 'NET', 'prelim', '2025-10-17 11:03:00', 'e70c0c48cd5151b538566bb598176f195e3f38c20e360a758bdfef676dc0e582', '2025-10-17 11:03:31'),
(288, 4, 'BSIT-1A', 'NET', 'prelim', '2025-10-17 11:03:00', 'e70c0c48cd5151b538566bb598176f195e3f38c20e360a758bdfef676dc0e582', '2025-10-17 11:04:55'),
(289, 4, 'BSIT-1A', 'NET', 'prefinal', '2025-10-17 11:09:00', 'e70c0c48cd5151b538566bb598176f195e3f38c20e360a758bdfef676dc0e582', '2025-10-17 11:09:08'),
(290, 4, 'BSIT-4A', 'NET', 'prefinal', '2025-10-17 11:10:00', 'e70c0c48cd5151b538566bb598176f195e3f38c20e360a758bdfef676dc0e582', '2025-10-17 11:11:02'),
(291, 4, 'BSIT-4A', 'NET', 'midterm', '2025-10-21 11:13:00', 'e70c0c48cd5151b538566bb598176f195e3f38c20e360a758bdfef676dc0e582', '2025-10-17 11:13:46'),
(292, 4, 'BSIT-4A', 'NET', 'quiz', '2025-10-09 11:13:00', 'e70c0c48cd5151b538566bb598176f195e3f38c20e360a758bdfef676dc0e582', '2025-10-17 11:16:57'),
(293, 4, 'BSIT-3C', 'NET', 'prefinal', '2025-10-20 10:15:00', 'e70c0c48cd5151b538566bb598176f195e3f38c20e360a758bdfef676dc0e582', '2025-10-20 10:16:02');

-- --------------------------------------------------------

--
-- Table structure for table `detections`
--

CREATE TABLE `detections` (
  `id` varchar(36) NOT NULL,
  `timestamp` datetime DEFAULT NULL,
  `epoch` double DEFAULT NULL,
  `image` longblob DEFAULT NULL,
  `image_path` longtext DEFAULT NULL,
  `image_data` longblob DEFAULT NULL,
  `assessment_session_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


--
-- Table structure for table `records`
--

CREATE TABLE `records` (
  `id` int(11) NOT NULL,
  `assessment_session_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `folder_name` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `records`
--

INSERT INTO `records` (`id`, `assessment_session_id`, `user_id`, `folder_name`, `created_at`) VALUES
(25, 290, 4, 'BSIT-4A_NET_prefinal_147217dd', '2025-10-17 11:11:02'),
(26, 291, 4, 'BSIT-4A_NET_midterm_e04a0159', '2025-10-17 11:13:46'),
(27, 292, 4, 'BSIT-4A_NET_quiz_130aafbc', '2025-10-17 11:16:57'),
(28, 293, 4, 'BSIT-3C_NET_prefinal_35ccb673', '2025-10-20 10:16:02');

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
(1, 'admin', '$2b$12$o9FOK1jKkV/O/vz4vmcehu8x/Epv3G36bQTTirsyZ/QLM7Ek8rQha', 'admin', NULL, 'Active', NULL, NULL, '2025-09-21 09:26:10', '2025-09-21 09:26:10'),
(4, 'Jomar23', '$2b$12$ReMikcC2suGL4HGP463BnOtYxBmgmJnsiEJNaMsoz7wzB5aqiDnZG', 'user', 'Jomar', 'Active', 'admin', 'admin', '2025-09-21 09:41:37', '2025-10-19 13:28:55'),
(6, 'Yoj', '$2b$12$jzMBr/IIJ9aFkzJjihFc4ei3VNNyZ.PWkoIzx.99FPCcH1h.6QuXG', 'user', 'yoj', 'Active', 'admin', NULL, '2025-09-22 12:26:31', '2025-09-22 12:26:31'),
(7, 'josh', '$2b$12$AdkTAvKrDpz1GQ50K.BtXOgcHTEqJtdzLYkQmzddhqQA2tW6Uzt1q', 'user', 'josh', 'Active', 'admin', 'admin', '2025-09-22 19:14:35', '2025-10-17 16:20:21'),
(9, 'jake', '$2b$12$r4Lyd90VN6V2P0XlIPiCw.8WiUqxyuSa7r/TQyIMBrNgZ/HkLHwlK', 'user', 'jake', 'Active', 'admin', 'admin', '2025-10-10 11:19:35', '2025-10-19 13:16:34'),
(10, 'James', '$2b$12$cFKmUyJSjFYkFO15JvZ/ROHyyez83hqeH2.ARbBJ9ETlDLwF81tnS', 'user', 'james', 'Active', 'admin', NULL, '2025-10-17 15:42:15', '2025-10-17 15:42:15');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `assessment_sessions`
--
ALTER TABLE `assessment_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `detections`
--
ALTER TABLE `detections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `assessment_session_id` (`assessment_session_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `records`
--
ALTER TABLE `records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_folder_unique` (`user_id`,`folder_name`),
  ADD KEY `assessment_session_idx` (`assessment_session_id`),
  ADD KEY `user_idx` (`user_id`);

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
-- AUTO_INCREMENT for table `assessment_sessions`
--
ALTER TABLE `assessment_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=294;

--
-- AUTO_INCREMENT for table `records`
--
ALTER TABLE `records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `assessment_sessions`
--
ALTER TABLE `assessment_sessions`
  ADD CONSTRAINT `assessment_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `detections`
--
ALTER TABLE `detections`
  ADD CONSTRAINT `detections_ibfk_1` FOREIGN KEY (`assessment_session_id`) REFERENCES `assessment_sessions` (`id`),
  ADD CONSTRAINT `detections_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `records`
--
ALTER TABLE `records`
  ADD CONSTRAINT `records_assessment_fk` FOREIGN KEY (`assessment_session_id`) REFERENCES `assessment_sessions` (`id`),
  ADD CONSTRAINT `records_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

DELIMITER $$
--
-- Events
--
CREATE DEFINER=`root`@`localhost` EVENT `delete_old_records` ON SCHEDULE EVERY 1 DAY STARTS '2025-10-20 10:20:43' ON COMPLETION NOT PRESERVE ENABLE DO BEGIN
    -- Delete from 'records' table
    DELETE FROM records
    WHERE created_at < NOW() - INTERVAL 30 DAY;

    -- Delete from 'detection' table
    DELETE FROM detection
    WHERE created_at < NOW() - INTERVAL 30 DAY;
END$$

DELIMITER ;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
