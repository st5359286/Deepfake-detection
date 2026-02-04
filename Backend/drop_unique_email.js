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
    console.error('Error connecting:', err);
    return;
  }
  console.log('Connected to database.');

  // Drop index 'email' if it exists. Note: The index name is usually the column name if created inline.
  const query = "DROP INDEX email ON users";

  connection.query(query, (err, result) => {
    if (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('Index "email" does not exist or already dropped.');
      } else {
        console.error('Error dropping index:', err);
      }
    } else {
      console.log('Successfully dropped UNIQUE constraint on email.');
    }
    connection.end();
  });
});
