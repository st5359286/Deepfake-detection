const mysql = require('mysql');
const bcrypt = require('bcryptjs');

const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'Suman@2002',
  database: 'project13_db'
};

const connection = mysql.createConnection(dbConfig);

const createAdmin = async () => {
  connection.connect();

  const username = 'admin';
  const email = 'admin@example.com';
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if user with username 'admin' exists
  connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      console.log('User "admin" already exists. Updating password and role...');
      // Update existing user to be admin with new password
      const query = 'UPDATE users SET password = ?, role = ?, is_verified = TRUE WHERE username = ?';
      connection.query(query, [hashedPassword, 'admin', username], (err) => {
        if (err) throw err;
        console.log('User "admin" updated successfully.');
        connection.end();
      });
    } else {
      console.log('User "admin" does not exist. Creating new user...');
      // Create new admin
      const query = 'INSERT INTO users (username, email, password, role, is_verified) VALUES (?, ?, ?, ?, TRUE)';
      connection.query(query, [username, email, hashedPassword, 'admin'], (err) => {
        if (err) throw err;
        console.log('User "admin" created successfully.');
        connection.end();
      });
    }
  });
};

createAdmin();
