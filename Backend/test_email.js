require('dotenv').config();
const nodemailer = require('nodemailer');

const emailUser = (process.env.EMAIL_USER || '').trim();
const emailPass = (process.env.EMAIL_PASS || '').trim();

console.log(`Testing Email Credentials...`);
console.log(`User: ${emailUser}`);
console.log(`Pass: ${emailPass ? '********(Hidden)' : 'MISSING'}`);

if (!emailUser || !emailPass || emailPass.includes('your_16_digit')) {
  console.error('ERROR: Credentials are stuck on placeholders. Please update .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

const mailOptions = {
  from: emailUser,
  to: emailUser, // Send to self for testing
  subject: 'Test Email from Deepfake Detector',
  text: 'If you are reading this, your Email Configuration is PERFECT! The issue is likely duplicate servers running.'
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('FAILED to send email:');
    console.error(error);
  } else {
    console.log('SUCCESS! Email sent successfully.');
    console.log('Response:', info.response);
  }
});
