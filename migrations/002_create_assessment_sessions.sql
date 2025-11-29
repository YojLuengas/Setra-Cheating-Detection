CREATE TABLE IF NOT EXISTS assessment_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    course VARCHAR(255) DEFAULT NULL,
    subject VARCHAR(255) DEFAULT NULL,
    exam_type VARCHAR(255) DEFAULT NULL,
    exam_datetime DATETIME DEFAULT NULL,
    camera VARCHAR(255) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE assessment_sessions
ADD COLUMN duration_minutes INT DEFAULT 60;

ALTER TABLE assessment_sessions
ADD COLUMN status varchar(50) DEFAULT 'active';