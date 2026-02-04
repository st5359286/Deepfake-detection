const mysql = require('mysql');

// --- IMPORTANT ---
// Replace these with your actual database credentials.
const db = mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'Suman@2002', // <-- ⚠️ IMPORTANT: Replace this with your actual MySQL root password
  database: 'project13_db'
});

db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Successfully connected to the database.');
});

module.exports = db;