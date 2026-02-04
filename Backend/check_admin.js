const mysql = require('mysql');
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'Suman@2002',
  database: 'project13_db'
};

const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }

  const query = "SELECT id, username, email, role FROM users WHERE role = 'admin'";
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching admins:', err);
    } else {
      console.log('Admin Users found:', JSON.stringify(results, null, 2));
    }
    connection.end();
  });
});
