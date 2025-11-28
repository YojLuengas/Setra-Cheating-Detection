-- Database: `sentra_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `assessment_sessions`
--
ALTER TABLE assessment_sessions
ADD COLUMN duration_minutes INT DEFAULT 60;

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
(285, 9, 'BAA', 'math', 'midterm', '2025-10-10 21:33:00', '0027b9aed895928a60d4aa20a82971c34c1a11d29b176a6df6449b2a86c5e087', '2025-10-10 21:34:04'),
(286, 9, 'BAA', 'math', 'midterm', '2025-10-10 13:34:06', 'default', '2025-10-10 21:34:06');

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

-- --------------------------------------------------------

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

-- --------------------------------------------------------

--
-- Table structure for table `users`
--
ALTER TABLE users ADD COLUMN subjects VARCHAR(255) DEFAULT NULL;

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
(1, 'admin', '$2b$12$o9FOK1jKkV/O/vz4vmcehu8x/Epv3G36bQTTirsyZ/QLM7Ek8rQha', 'admin', NULL, 'Active', NULL, NULL, '2025-09-21 05:26:10', '2025-09-21 05:26:10'),
(2, 'Ara', '$2b$12$u8lyB3a6zi5uBL3g.6rLTud04S5Xh3FeskTVO/SsUDVltbh0rxRMC', 'user', NULL, 'Active', NULL, 'admin', '2025-09-21 05:26:10', '2025-09-21 05:59:45'),
(3, 'marken', '$2b$12$ZJkAwWZ4uba5CK9lrSefCeGz2JU.s8Aypqm6./RYXjH.8uobS1mYu', 'user', NULL, 'Active', NULL, 'admin', '2025-09-21 05:26:10', '2025-09-23 09:09:54'),
(4, 'Jomar23', '$2b$12$Tx/vyWKq5G7bDeQ8eDQeuem0D2fMjMmVo24CvXBZBRWdIF32sEU8O', 'user', 'Jomar', 'Active', 'admin', 'admin', '2025-09-21 05:41:37', '2025-09-21 05:59:39'),
(6, 'Yoj', '$2b$12$jzMBr/IIJ9aFkzJjihFc4ei3VNNyZ.PWkoIzx.99FPCcH1h.6QuXG', 'user', 'yoj', 'Active', 'admin', NULL, '2025-09-22 08:26:31', '2025-09-22 08:26:31'),
(7, 'josh', '$2b$12$C1uCldLx2d5D92zXEPbWou9k9S2QPa3PwxrQcalp85/cbDE38wW/y', 'user', 'josh', 'Active', 'admin', NULL, '2025-09-22 15:14:35', '2025-09-22 15:14:35'),
(9, 'jake', '$2b$12$r4Lyd90VN6V2P0XlIPiCw.8WiUqxyuSa7r/TQyIMBrNgZ/HkLHwlK', 'user', 'jake', 'Active', 'admin', NULL, '2025-10-10 07:19:35', '2025-10-10 07:19:35');

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
  ADD KEY `assessment_session_idx` (`assessment_session_id`),
  ADD KEY `user_idx` (`user_id`),
  ADD UNIQUE KEY `user_folder_unique` (`user_id`, `folder_name`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=287;

--
-- AUTO_INCREMENT for table `records`
--
ALTER TABLE `records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

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
COMMIT;
