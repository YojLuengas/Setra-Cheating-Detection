CREATE TABLE IF NOT EXISTS records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    assessment_session_id INT NOT NULL,
    user_id INT NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY user_folder_unique (user_id, folder_name),
    FOREIGN KEY (assessment_session_id) REFERENCES assessment_sessions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);