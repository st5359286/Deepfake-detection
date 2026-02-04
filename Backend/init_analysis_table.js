const db = require('./db');

const createTableQuery = `
CREATE TABLE IF NOT EXISTS analysis_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    is_deepfake BOOLEAN,
    confidence INT,
    file_hash VARCHAR(255),
    analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

db.query(createTableQuery, (err, result) => {
  if (err) {
    console.error('Error creating analysis_log table:', err);
    process.exit(1);
  }
  console.log('analysis_log table verified/created successfully.');
  process.exit(0);
});
