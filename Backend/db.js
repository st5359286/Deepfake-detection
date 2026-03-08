const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Create SQLite database file
const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
    initializeTables();
  }
});

// Initialize tables function
function initializeTables() {
  db.serialize(() => {
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        is_verified INTEGER DEFAULT 0,
        otp_code TEXT,
        otp_expires DATETIME,
        password_reset_token TEXT,
        password_reset_expires DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create analysis_log table
    db.run(`
      CREATE TABLE IF NOT EXISTS analysis_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        is_deepfake INTEGER,
        confidence INTEGER,
        analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    console.log("Database tables initialized.");
  });
}

// Helper function to run queries
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper function to run a single query (for INSERT/UPDATE)
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = { db, query, run };
