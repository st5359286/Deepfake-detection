const db = require('./db');

const email = 'sumanthakur2002d@gmail.com';

console.log('Checking database for user:', email);

const query = 'SELECT * FROM users WHERE email = ?';
db.query(query, [email], (err, results) => {
  if (err) {
    console.error('Database Error:', err);
    process.exit(1);
  }
  console.log('User Found:', results.length);
  if (results.length > 0) {
    const user = results[0];
    console.log('User Data:', {
      id: user.id,
      username: user.username,
      email: user.email,
      is_verified: user.is_verified,
      otp_code: user.otp_code,
      otp_expires: user.otp_expires
    });
  } else {
    console.log('No user found with that email.');
  }

  // Also check generic 'thakur_rakesh' username just in case
  const q2 = 'SELECT * FROM users WHERE username = ?';
  db.query(q2, ['thakur_rakesh'], (e, r) => {
    if (r && r.length > 0) {
      console.log('Found by username instead:', r[0]);
    }
    process.exit(0);
  });
});
