const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const upload = multer(); // Middleware for handling form-data, primarily for file uploads
const db = require('./db');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- API Endpoints ---

// Register Endpoint
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required.' });
    }

    // Check if user already exists
    const checkUserQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(checkUserQuery, [username, email], async (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ message: 'Internal server error.' });
        }

        if (results.length > 0) {
            return res.status(409).json({ message: 'Username or email already exists.' });
        }

        try {
            // Hash the password before storing it
            const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt round

            const insertUserQuery = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
            db.query(insertUserQuery, [username, email, hashedPassword, 'user'], (err, result) => {
                if (err) {
                    console.error('Database insert error:', err);
                    return res.status(500).json({ message: 'Failed to register user.' });
                }
                res.status(201).json({ message: 'User registered successfully. You can now log in.' });
            });
        } catch (hashError) {
            console.error('Password hashing error:', hashError);
            return res.status(500).json({ message: 'Internal server error during registration.' });
        }
    });
});

// Login Endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    // IMPORTANT: In a real application, you should hash passwords and not store them in plain text.
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ message: 'Internal server error.' });
        }

        if (results.length > 0) {
            const user = results[0];
            // Compare submitted password with the hashed password in the database
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                res.json({ message: 'Login successful', user: { id: user.id, username: user.username, email: user.email, role: user.role } });
            } else {
                res.status(401).json({ message: 'Invalid credentials.' });
            }
        } else {
            res.status(401).json({ message: 'Invalid credentials.' });
        }
    });
});

// --- Password Reset Endpoints ---

// 1. Forgot Password Endpoint
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    const findUserQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(findUserQuery, [email], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ message: 'Internal server error.' });
        }

        // Always send a success-like response to prevent email enumeration attacks
        if (results.length === 0) {
            console.log(`Password reset attempt for non-existent email: ${email}`);
            return res.json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        }

        const user = results[0];
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        const updateUserQuery = 'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?';
        db.query(updateUserQuery, [token, expires, user.id], async (err, result) => {
            if (err) {
                console.error('Database update error:', err);
                return res.status(500).json({ message: 'Failed to set reset token.' });
            }

            // --- Email Sending Simulation ---
            // In a real app, you would use a real email service (SendGrid, Mailgun, etc.)
            // For development, we'll log it to the console.
            const resetURL = `http://localhost:3000/reset-password.html?token=${token}`;
            console.log('--- PASSWORD RESET EMAIL ---');
            console.log(`To: ${user.email}`);
            console.log(`Subject: Password Reset Request`);
            console.log(`\nYou are receiving this because you (or someone else) have requested the reset of the password for your account.`);
            console.log(`Please click on the following link, or paste this into your browser to complete the process:\n`);
            console.log(resetURL);
            console.log(`\nIf you did not request this, please ignore this email and your password will remain unchanged.`);
            console.log('--------------------------');

            res.json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        });
    });
});

// 2. Reset Password Endpoint
app.post('/reset-password', (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    const findUserQuery = 'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()';
    db.query(findUserQuery, [token], async (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ message: 'Internal server error.' });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        const user = results[0];
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password and clear the reset token fields
        const updateUserQuery = 'UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?';
        db.query(updateUserQuery, [hashedPassword, user.id], (err, result) => {
            if (err) {
                console.error('Database update error:', err);
                return res.status(500).json({ message: 'Failed to reset password.' });
            }
            res.json({ message: 'Password has been successfully reset. You can now log in.' });
        });
    });
});

// --- New Endpoints (from app.py) ---

// Mock Analysis Endpoint
app.post('/api/analyze', upload.single('media'), (req, res) => {
    /**
     * A mock analysis endpoint.
     * In a real application, this is where you would process the uploaded file.
     */
    if (!req.file) {
        return res.status(400).json({ error: "No media file found in the request" });
    }

    // Simulate a processing delay
    setTimeout(() => {
        // This is placeholder data. Replace this with your actual analysis logic.
        const is_fake = Math.random() < 0.5;
        const confidence = Math.floor(Math.random() * (98 - 75 + 1)) + 75;

        // This is placeholder data. In a real application, this would be the
        // result of a complex analysis process.
        const mockResult = {
            is_deepfake: is_fake,
            confidence: confidence,
            chief_judgment: {
                title: "Overall Assessment",
                description: is_fake
                    ? "The media shows moderate signs of manipulation, but further expert review is recommended."
                    : "The media appears to be authentic with no significant signs of manipulation found."
            },
            visual_analysis: [
                { title: 'Lighting Inconsistencies', description: 'Shadows around the subject do not fully match the environment.', level: is_fake ? 'Medium' : 'Low' },
                { title: 'Facial Artifacts', description: 'Minor blurring observed around the mouth during speech.', level: is_fake ? 'High' : 'Low' }
            ],
            metadata_analysis: [
                { title: 'EXIF Data', description: 'Creation date appears to be modified after original capture.', level: is_fake ? 'High' : 'Low' }
            ],
            forensics: [
                { title: "Noise Pattern", "description": "Inconsistent noise patterns detected in the background.", "level": is_fake ? "Medium" : "Low" },
                { title: "Compression Analysis", "description": "No unusual compression artifacts found.", "level": "Low" }
            ]
        };

        // Log the analysis to the database
        const { userId } = req.body;
        if (userId) {
            const logQuery = 'INSERT INTO analysis_log (user_id, is_deepfake, confidence) VALUES (?, ?, ?)';
            db.query(logQuery, [userId, mockResult.is_deepfake, mockResult.confidence], (err) => {
                if (err) console.error('Failed to log analysis:', err);
            });
        }

        res.json(mockResult);
    }, 500); // Reduced delay to 0.5 seconds
});

// Mock Summary Endpoint
app.post('/api/summarize', (req, res) => {
    // Simulate a delay for summary generation
    setTimeout(() => {
        res.json({ "summary": "This is a mock summary of the forensic analysis report. The analysis detected several key indicators." });
    }, 1000); // 1-second delay
});

// --- New Admin Endpoint ---
app.get('/api/admin/activity', (req, res) => {
    // In a real application, you would query a database for user analysis logs.
    // This is mock data for demonstration.
    const mockActivity = [
        { id: 1, username: 'john_doe', analyses_today: 5, total_analyses: 45, last_active: '2023-10-27T10:00:00Z' },
        { id: 2, username: 'jane_smith', analyses_today: 2, total_analyses: 120, last_active: '2023-10-27T11:30:00Z' },
        { id: 3, username: 'test_user', analyses_today: 0, total_analyses: 15, last_active: '2023-10-26T15:00:00Z' },
        { id: 4, username: 'data_analyst', analyses_today: 8, total_analyses: 250, last_active: '2023-10-27T12:00:00Z' }
    ];

    // Here you might add authentication/authorization middleware to ensure only admins can access.
    res.json(mockActivity);
});

// --- New User Activity Endpoint ---
app.get('/api/user-activity/:userId', (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const activityQuery = `
        SELECT
            (SELECT COUNT(*) FROM analysis_log WHERE user_id = ?) AS totalAnalyses,
            (SELECT COUNT(*) FROM analysis_log WHERE user_id = ? AND DATE(analysis_timestamp) = CURDATE()) AS analysesToday,
            (SELECT AVG(confidence) FROM analysis_log WHERE user_id = ?) AS avgConfidence;
    `;

    db.query(activityQuery, [userId, userId, userId], (err, results) => {
        if (err) {
            console.error('Database query error for user activity:', err);
            return res.status(500).json({ message: 'Internal server error.' });
        }

        if (results.length > 0) {
            const stats = results[0];
            res.json({
                totalAnalyses: stats.totalAnalyses || 0,
                analysesToday: stats.analysesToday || 0,
                avgConfidence: stats.avgConfidence ? Math.round(stats.avgConfidence) : 0,
            });
        }
    });
});

// Protected Dashboard Endpoint
app.get('/dashboard', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(401).json({ message: 'Unauthorized: No user specified.' });
    }

    // In a real app, you would validate a token here instead of just trusting the username.
    const query = 'SELECT id, username, email FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Internal server error.' });
        }
        if (results.length > 0) {
            res.json({ message: `Welcome to your dashboard, ${username}!`, user: results[0] });
        } else {
            res.status(404).json({ message: 'User not found.' });
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});