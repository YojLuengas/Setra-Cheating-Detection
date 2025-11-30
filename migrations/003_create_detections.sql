CREATE TABLE IF NOT EXISTS detections (
    id VARCHAR(36) PRIMARY KEY,
    timestamp DATETIME DEFAULT NULL,
    epoch DOUBLE DEFAULT NULL,
    image LONGBLOB DEFAULT NULL,
    image_path LONGTEXT DEFAULT NULL,
    image_data LONGBLOB DEFAULT NULL,
    assessment_session_id INT DEFAULT NULL,
    user_id INT DEFAULT NULL,
    FOREIGN KEY (assessment_session_id) REFERENCES assessment_sessions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);