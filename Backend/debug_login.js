const mysql = require('mysql');
const bcrypt = require('bcryptjs');

// Must match db.js EXACTLY
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'Suman@2002',
  database: 'project13_db'
};

const connection = mysql.createConnection(dbConfig);

const testLogin = async () => {
  connection.connect();

  console.log("Testing login for user 'admin'...");

  connection.query("SELECT * FROM users WHERE username = 'admin'", async (err, results) => {
    if (err) {
      console.error("DB Query Error:", err);
      connection.end();
      return;
    }

    if (results.length === 0) {
      console.error("User 'admin' NOT FOUND in database.");
      connection.end();
      return;
    }

    const user = results[0];
    console.log("User found:", { id: user.id, username: user.username, role: user.role, is_verified: user.is_verified, password_hash: user.password });

    const inputPassword = 'admin123';
    const isMatch = await bcrypt.compare(inputPassword, user.password);

    if (isMatch) {
      console.log("SUCCESS: Password 'admin123' MATCHES the hash in the DB.");
    } else {
      console.error("FAILURE: Password 'admin123' does NOT match the hash.");

      // Debug: Create a new hash to see what it should look like
      const newHash = await bcrypt.hash(inputPassword, 10);
      console.log("Expected Hash format (example):", newHash);
    }

    connection.end();
  });
};

testLogin();
