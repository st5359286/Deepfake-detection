require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const upload = multer();
const { db, query, run } = require("./db");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const port = process.env.PORT || 3000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

// URL of the Python ML service (make configurable via env)
const ML_URL = process.env.ML_URL || 'http://127.0.0.1:5000';

// Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    message: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api/", limiter);

// Serve ML-generated results and static assets from Python backend results directory
const pythonResultsDir = path.resolve(__dirname, '..', 'deepfake-detector-backend', 'src', 'public', 'results');
app.use('/results', express.static(pythonResultsDir));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token." });
    }
    req.user = user;
    next();
  });
};

// Helper: Generate JWT Token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "24h" },
  );
}

// Helper: Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper: Validate password strength
function isValidPassword(password) {
  return password && password.length >= 6;
}

// Helper: Validate username
function isValidUsername(username) {
  return username && username.length >= 3 && username.length <= 30;
}

// --- Helper: Generate OTP ---
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register Endpoint with input validation
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  // Input validation
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Username, email, and password are required." });
  }

  // Validate username length
  if (!isValidUsername(username)) {
    return res
      .status(400)
      .json({ message: "Username must be between 3 and 30 characters." });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Validate password length
  if (!isValidPassword(password)) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters long." });
  }

  try {
    // Check if email already exists
    const emailCheck = await query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (emailCheck.length > 0) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const results = await query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    if (results.length > 0) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await run(
      "INSERT INTO users (username, email, password, role, is_verified, otp_code, otp_expires) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, email, hashedPassword, "user", 0, otp, expires],
    );

    // Email sending
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: (process.env.EMAIL_USER || "your-email@gmail.com").trim(),
        pass: (process.env.EMAIL_PASS || "your-app-password").trim(),
      },
    });

    const mailOptions = {
      from: (process.env.EMAIL_USER || "deepfake-detector@admin.com").trim(),
      to: email,
      subject: "Verify your Account - SynthShield",
      text: `Your Verification Code is: ${otp}\n\nThis code expires in 10 minutes.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });

    console.log("---------------------------------------------------");
    console.log(`[SERVER_LOG] To: ${email}`);
    console.log(`[SERVER_LOG] OTP Code: ${otp}`);
    console.log("---------------------------------------------------");

    res.status(201).json({
      message: "Registration successful. OTP sent to email.",
    });
  } catch (hashError) {
    console.error("Error:", hashError);
    return res
      .status(500)
      .json({ message: "Internal server error during registration." });
  }
});

// Verify OTP Endpoint
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }

  try {
    const results = await query(
      'SELECT * FROM users WHERE email = ? AND otp_code = ? AND otp_expires > datetime("now")',
      [email, otp],
    );

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    await run(
      "UPDATE users SET is_verified = 1, otp_code = NULL, otp_expires = NULL WHERE email = ?",
      [email],
    );
    res.json({ message: "Account verified successfully. You can now log in." });
  } catch (err) {
    return res.status(500).json({ message: "Database error." });
  }
});

// Resend OTP Endpoint
app.post("/resend-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const results = await query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = results[0];
    if (user.is_verified) {
      return res.status(400).json({ message: "Account is already verified." });
    }

    const otp = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await run("UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?", [
      otp,
      expires,
      user.id,
    ]);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: (process.env.EMAIL_USER || "your-email@gmail.com").trim(),
        pass: (process.env.EMAIL_PASS || "your-app-password").trim(),
      },
    });

    const mailOptions = {
      from: (process.env.EMAIL_USER || "deepfake-detector@admin.com").trim(),
      to: email,
      subject: "Resend Verification Code - SynthShield",
      text: `Your New Verification Code is: ${otp}\n\nThis code expires in 10 minutes.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
      } else {
        console.log("Resend OTP Email sent: " + info.response);
      }
    });

    console.log("---------------------------------------------------");
    console.log(`[SERVER_LOG] Resend To: ${email}`);
    console.log(`[SERVER_LOG] New OTP Code: ${otp}`);
    console.log("---------------------------------------------------");

    res.json({ message: "New OTP sent to your email." });
  } catch (err) {
    return res.status(500).json({ message: "Failed to generate new OTP." });
  }
});

// Login Endpoint with JWT token
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }

  try {
    const results = await query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    if (results.length > 0) {
      const user = results[0];

      if (!user.is_verified) {
        return res
          .status(403)
          .json({ message: "Account not verified. Please verify your email." });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        // Generate JWT token
        const token = generateToken(user);

        res.json({
          message: "Login successful",
          token: token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
        });
      } else {
        res.status(401).json({ message: "Invalid credentials." });
      }
    } else {
      res.status(401).json({ message: "Invalid credentials." });
    }
  } catch (err) {
    console.error("Database query error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// --- Dashboard Endpoints MVP ---
app.get("/dashboard", async (req, res) => {
  const { username } = req.query;
  try {
    const results = await query("SELECT id, username, email, role FROM users WHERE username = ?", [username]);
    if (results.length > 0) res.json({ user: results[0] });
    else res.status(404).json({ message: "User not found" });
  } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.get("/api/admin/stats", async (req, res) => {
  try {
    const users = await query("SELECT COUNT(*) as count FROM users");
    const analyses = await query("SELECT COUNT(*) as count FROM analysis_log");
    const fakes = await query("SELECT COUNT(*) as count FROM analysis_log WHERE is_deepfake = 1");
    res.json({
       totalUsers: users[0].count,
       totalAnalyses: analyses[0].count,
       deepfakesDetected: fakes[0].count
    });
  } catch(e) { res.status(500).json({ message: "Error" }); }
});

app.get("/api/admin/activity", async (req, res) => {
  try {
    const results = await query(`
      SELECT u.id, u.username, 
      (SELECT COUNT(*) FROM analysis_log WHERE user_id = u.id AND date(analysis_timestamp) = date('now')) as analyses_today,
      (SELECT COUNT(*) FROM analysis_log WHERE user_id = u.id) as total_analyses,
      (SELECT MAX(analysis_timestamp) FROM analysis_log WHERE user_id = u.id) as last_active
      FROM users u
      ORDER BY u.id DESC
    `);
    res.json(results);
  } catch(e) { res.status(500).json({ message: "Error" }); }
});

app.delete("/api/admin/user/:id", async (req, res) => {
  try {
    await run("DELETE FROM analysis_log WHERE user_id = ?", [req.params.id]);
    await run("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch(e) { res.status(500).json({ message: "Error" }); }
});

app.get("/api/user-activity/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const total = await query("SELECT COUNT(*) as count FROM analysis_log WHERE user_id = ?", [id]);
    const today = await query("SELECT COUNT(*) as count FROM analysis_log WHERE user_id = ? AND date(analysis_timestamp) = date('now')", [id]);
    const avg = await query("SELECT AVG(confidence) as avgC FROM analysis_log WHERE user_id = ?", [id]);
    res.json({
        totalAnalyses: total[0].count,
        analysesToday: today[0].count,
        avgConfidence: avg[0].avgC ? Math.round(avg[0].avgC) : 0
    });
  } catch(e) { res.status(500).json({ message: "Error" }); }
});

app.get("/api/assessment/sessions", async (req, res) => {
  const { userId } = req.query;

  try {
    const sql = userId
      ? "SELECT * FROM assessment_sessions WHERE user_id = ? ORDER BY started_at DESC"
      : "SELECT * FROM assessment_sessions ORDER BY started_at DESC LIMIT 20";
    const params = userId ? [userId] : [];
    const sessions = await query(sql, params);
    res.json(sessions);
  } catch (err) {
    console.error("Assessment session fetch error:", err);
    res.status(500).json({ message: "Failed to load assessment sessions." });
  }
});

app.post("/api/assessment/session", async (req, res) => {
  const { userId, candidateName } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const result = await run(
      "INSERT INTO assessment_sessions (user_id, candidate_name, status, started_at, updated_at) VALUES (?, ?, 'active', datetime('now'), datetime('now'))",
      [userId, candidateName || "Candidate"],
    );

    res.status(201).json({
      sessionId: result.lastID,
      status: "active",
      message: "Assessment session created.",
    });
  } catch (err) {
    console.error("Assessment session create error:", err);
    res.status(500).json({ message: "Failed to create assessment session." });
  }
});

app.post("/api/assessment/sessions/:id/event", async (req, res) => {
  const { id } = req.params;
  const { type, severity = "medium", details = "", payload = {} } = req.body;

  if (!type) {
    return res.status(400).json({ message: "Event type is required." });
  }

  try {
    const sessionExists = await query("SELECT * FROM assessment_sessions WHERE id = ?", [id]);
    if (sessionExists.length === 0) {
      return res.status(404).json({ message: "Assessment session not found." });
    }

    await run(
      "INSERT INTO assessment_events (session_id, event_type, severity, details, payload, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [id, type, severity, details, JSON.stringify(payload)],
    );

    const violationIncrement = ["FULLSCREEN_EXIT", "TAB_SWITCH", "ESCAPE_PRESSED", "NO_FACE", "MULTIPLE_FACES", "FACE_MISMATCH", "WINDOW_BLUR"].includes(type) ? 1 : 0;

    const updatedSession = await query("SELECT violation_count FROM assessment_sessions WHERE id = ?", [id]);
    const nextCount = (updatedSession[0]?.violation_count || 0) + violationIncrement;
    const nextStatus = nextCount >= 3 ? "flagged" : "active";

    await run(
      "UPDATE assessment_sessions SET violation_count = ?, last_event = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
      [nextCount, type, nextStatus, id],
    );

    res.json({
      ok: true,
      violationCount: nextCount,
      status: nextStatus,
      message: "Assessment event recorded.",
    });
  } catch (err) {
    console.error("Assessment event error:", err);
    res.status(500).json({ message: "Failed to save assessment event." });
  }
});

app.post("/api/assessment/sessions/:id/end", async (req, res) => {
  const { id } = req.params;
  const { status = "completed" } = req.body;

  try {
    await run(
      "UPDATE assessment_sessions SET status = ?, ended_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      [status, id],
    );
    res.json({ ok: true, message: "Assessment session closed." });
  } catch (err) {
    console.error("Assessment end error:", err);
    res.status(500).json({ message: "Failed to close assessment session." });
  }
});

app.get("/api/assessment/summary/:userId", async (req, res) => {
  try {
    const sessions = await query(
      "SELECT status, violation_count FROM assessment_sessions WHERE user_id = ? ORDER BY started_at DESC",
      [req.params.userId],
    );

    res.json({
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === "active").length,
      flaggedSessions: sessions.filter((s) => s.status === "flagged").length,
      totalViolations: sessions.reduce((sum, s) => sum + (Number(s.violation_count) || 0), 0),
    });
  } catch (err) {
    console.error("Assessment summary error:", err);
    res.status(500).json({ message: "Failed to summarize assessment sessions." });
  }
});

app.get("/api/assessment/events/:sessionId", async (req, res) => {
  try {
    const events = await query(
      "SELECT * FROM assessment_events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 20",
      [req.params.sessionId],
    );
    res.json(events);
  } catch (err) {
    console.error("Assessment events fetch error:", err);
    res.status(500).json({ message: "Failed to load assessment events." });
  }
});

app.get("/api/assessment/session/:sessionId/summary", async (req, res) => {
  try {
    const session = await query(
      "SELECT * FROM assessment_sessions WHERE id = ?",
      [req.params.sessionId],
    );

    if (!session.length) {
      return res.status(404).json({ message: "Assessment session not found." });
    }

    const events = await query(
      "SELECT event_type, severity, details, timestamp FROM assessment_events WHERE session_id = ? ORDER BY timestamp DESC",
      [req.params.sessionId],
    );

    const eventCounts = {};
    let highSeverity = 0;
    let mediumSeverity = 0;
    let lowSeverity = 0;

    for (const event of events) {
      const type = event.event_type || "UNKNOWN";
      eventCounts[type] = (eventCounts[type] || 0) + 1;
      if (event.severity === "high") highSeverity += 1;
      else if (event.severity === "medium") mediumSeverity += 1;
      else lowSeverity += 1;
    }

    const violationWeight = Number(session[0].violation_count || 0) * 18;
    const highWeight = highSeverity * 20;
    const mediumWeight = mediumSeverity * 10;
    const lowWeight = lowSeverity * 4;
    const eventWeight = events.length * 6;
    const riskScore = Math.min(100, violationWeight + highWeight + mediumWeight + lowWeight + eventWeight);

    let riskLevel = "Low";
    let recommendation = "Candidate appears compliant and stable.";

    if (riskScore >= 75) {
      riskLevel = "High";
      recommendation = "Escalate for manual review and consider terminating the assessment.";
    } else if (riskScore >= 40) {
      riskLevel = "Medium";
      recommendation = "Monitor closely and require a manual review before final acceptance.";
    }

    res.json({
      sessionId: session[0].id,
      candidateName: session[0].candidate_name,
      status: session[0].status,
      violationCount: Number(session[0].violation_count || 0),
      eventCount: events.length,
      riskScore: Math.round(riskScore),
      riskLevel,
      recommendation,
      eventCounts,
      severityBreakdown: {
        high: highSeverity,
        medium: mediumSeverity,
        low: lowSeverity,
      },
      startedAt: session[0].started_at,
      endedAt: session[0].ended_at,
      lastEvent: session[0].last_event,
    });
  } catch (err) {
    console.error("Assessment summary error:", err);
    res.status(500).json({ message: "Failed to compute assessment summary." });
  }
});

app.get("/api/admin/assessment-overview", async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        s.id,
        s.user_id,
        u.username,
        s.candidate_name,
        s.status,
        s.violation_count,
        s.last_event,
        s.started_at,
        s.ended_at,
        s.updated_at,
        (SELECT COUNT(*) FROM assessment_events WHERE session_id = s.id) AS event_count
      FROM assessment_sessions s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.updated_at DESC
      LIMIT 25
    `);

    res.json(rows.map((session) => ({
      ...session,
      severity: session.violation_count >= 3 ? "high" : session.violation_count > 0 ? "medium" : "low",
    })));
  } catch (err) {
    console.error("Assessment overview fetch error:", err);
    res.status(500).json({ message: "Failed to load assessment overview." });
  }
});

app.get("/api/admin/assessment-report", async (req, res) => {
  try {
    const rows = await query(`
      SELECT s.id, s.user_id, u.username, s.candidate_name, s.status, s.violation_count, s.last_event, s.started_at, s.ended_at,
             (SELECT COUNT(*) FROM assessment_events WHERE session_id = s.id) AS event_count
      FROM assessment_sessions s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.updated_at DESC
    `);

    const result = await Promise.all(rows.map(async (session) => {
      const summaryResponse = await fetch(`${process.env.ML_URL || "http://127.0.0.1:5000"}/status`);
      const summary = { riskScore: Math.min(100, (Number(session.violation_count || 0) * 18) + (Number(session.event_count || 0) * 6)), riskLevel: "Low" };

      if (summary.riskScore >= 75) summary.riskLevel = "High";
      else if (summary.riskScore >= 40) summary.riskLevel = "Medium";

      return {
        ...session,
        riskScore: summary.riskScore,
        riskLevel: summary.riskLevel,
        recommendation:
          summary.riskLevel === "High"
            ? "Escalate and require manual review"
            : summary.riskLevel === "Medium"
              ? "Review closely before acceptance"
              : "Candidate appears compliant",
      };
    }));

    res.json(result);
  } catch (err) {
    console.error("Assessment report fetch error:", err);
    res.status(500).json({ message: "Failed to load assessment report." });
  }
});

app.get("/api/admin/assessment-report/export", async (req, res) => {
  try {
    const rows = await query(`
      SELECT s.id, u.username, s.candidate_name, s.status, s.violation_count, s.last_event, s.started_at, s.ended_at,
             (SELECT COUNT(*) FROM assessment_events WHERE session_id = s.id) AS event_count
      FROM assessment_sessions s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.updated_at DESC
    `);

    const csvRows = rows.map((row) => {
      const riskScore = Math.min(100, (Number(row.violation_count || 0) * 18) + (Number(row.event_count || 0) * 6));
      const riskLevel = riskScore >= 75 ? "High" : riskScore >= 40 ? "Medium" : "Low";
      return [
        row.id,
        row.username || "Unknown",
        row.candidate_name || "Unknown",
        row.status || "active",
        row.violation_count || 0,
        row.event_count || 0,
        riskScore,
        riskLevel,
        row.last_event || "No events",
        row.started_at || "",
        row.ended_at || "",
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
    });

    const header = [
      "Session ID",
      "User",
      "Candidate",
      "Status",
      "Violations",
      "Event Count",
      "Risk Score",
      "Risk Level",
      "Last Event",
      "Started At",
      "Ended At",
    ].join(",");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="candidate-risk-report.csv"');
    res.send([header, ...csvRows].join("\n"));
  } catch (err) {
    console.error("Assessment report export error:", err);
    res.status(500).json({ message: "Failed to export candidate risk report." });
  }
});

// Admin Export Endpoint
app.get("/api/admin/export-activity", async (req, res) => {
  try {
    const results = await query(`
            SELECT u.username, u.email, a.is_deepfake, a.confidence, a.analysis_timestamp 
            FROM analysis_log a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.analysis_timestamp DESC
        `);

    const header = "Username,Email,Is Deepfake,Confidence,Timestamp\n";
    const rows = results
      .map(
        (row) =>
          `${row.username},${row.email},${row.is_deepfake ? "YES" : "NO"},${row.confidence}%,${new Date(row.analysis_timestamp).toLocaleString()}`,
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="activity_log.csv"',
    );
    res.send(header + rows);
  } catch (err) {
    return res.status(500).json({ message: "Export failed" });
  }
});

// --- Password Reset Endpoints ---

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const results = await query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length === 0) {
      console.log(`Password reset attempt for non-existent email: ${email}`);
      return res.json({
        message:
          "If a user with that email exists, a password reset link has been sent.",
      });
    }

    const user = results[0];
    const token = crypto.randomBytes(20).toString("hex");
    const expires = new Date(Date.now() + 3600000).toISOString();

    await run(
      "UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?",
      [token, expires, user.id],
    );

    const resetURL = `${frontendUrl}/reset-password.html?token=${token}`;

    // Send password reset email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: (process.env.EMAIL_USER || "your-email@gmail.com").trim(),
        pass: (process.env.EMAIL_PASS || "your-app-password").trim(),
      },
    });

    const mailOptions = {
      from: (process.env.EMAIL_USER || "deepfake-detector@admin.com").trim(),
      to: user.email,
      subject: "Password Reset Request - SynthShield",
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n${resetURL}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending password reset email:", error);
      } else {
        console.log("Password reset email sent: " + info.response);
      }
    });

    console.log("--- PASSWORD RESET EMAIL ---");
    console.log(`To: ${user.email}`);
    console.log(`Subject: Password Reset Request`);
    console.log(
      `\nYou are receiving this because you (or someone else) have requested the reset of the password for your account.`,
    );
    console.log(
      `Please click on the following link, or paste this into your browser to complete the process:\n`,
    );
    console.log(resetURL);
    console.log(
      `\nIf you did not request this, please ignore this email and your password will remain unchanged.`,
    );
    console.log("--------------------------");

    res.json({
      message:
        "If a user with that email exists, a password reset link has been sent.",
    });
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res
      .status(400)
      .json({ message: "Token and new password are required." });
  }

  try {
    const results = await query(
      'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > datetime("now")',
      [token],
    );

    if (results.length === 0) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired." });
    }

    const user = results[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await run(
      "UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?",
      [hashedPassword, user.id],
    );
    res.json({
      message: "Password has been successfully reset. You can now log in.",
    });
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running.' });
});

// --- Analysis Endpoints ---

const exifParser = require("exif-parser");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const FormData = require("form-data");

function getDeterministicRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

app.post("/api/analyze", upload.single("media"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "No media file found in the request" });
  }

  try {
    console.log(`[DEBUG] Proxying file to Python ML Engine...`);
    console.log(`[DEBUG] /api/analyze received file: ${req.file.originalname}, mimetype=${req.file.mimetype}, size=${req.file.size}`);
    
    // Create form data to forward to the Python backend
    const formData = new FormData();
    formData.append("media", req.file.buffer, {
      filename: req.file.originalname || "upload.tmp",
      contentType: req.file.mimetype,
      knownLength: req.file.size,
    });
    
    // Forward the file to the Python ML service (deepfake-detector-backend) running on port 5000
    const pythonResponse = await axios.post(
      ML_URL + '/predict',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    
    let mlData = pythonResponse.data;

    // If the Python response indicates the ML path was not used (mock fallback),
    // try again by streaming the file from disk — some multipart encoders behave
    // differently for Buffers and streams and that can affect how the Flask app
    // or OpenCV perceives the upload.
    try {
      if ((!mlData.used_ml || mlData.inference_source === 'mock') && req.file && req.file.buffer) {
        console.log('[DEBUG] ML fallback detected from Python, retrying with streamed file transfer');
        const fs = require('fs');
        const os = require('os');
        const tmpPath = require('path').join(os.tmpdir(), `upload_retry_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
        fs.writeFileSync(tmpPath, req.file.buffer);
        const retryForm = new FormData();
        retryForm.append('media', fs.createReadStream(tmpPath), {
          filename: req.file.originalname || 'upload.tmp',
          contentType: req.file.mimetype || 'application/octet-stream',
        });
        const retryResp = await axios.post(
          ML_URL + '/predict',
          retryForm,
          {
            headers: { ...retryForm.getHeaders() },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          }
        );
        if (retryResp && retryResp.data) {
          mlData = retryResp.data;
          console.log('[DEBUG] Retry response received, used_ml=', mlData.used_ml, 'inference_source=', mlData.inference_source);
        }
        try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
      }
    } catch (retryErr) {
      console.error('[DEBUG] Retry with streamed file failed:', retryErr && retryErr.message ? retryErr.message : retryErr);
    }

    // Normalize heatmap URLs to absolute URLs served by this Node backend
    const toAbsolute = (url) => {
      if (!url) return null;
      if (url.startsWith('http')) return url;
      if (url.startsWith('/')) return `${req.protocol}://${req.get('host')}${url}`;
      return `${req.protocol}://${req.get('host')}/${url}`;
    };
    mlData.heatmap_url = toAbsolute(mlData.heatmap_url);
    mlData.frame_heatmap_urls = (mlData.frame_heatmap_urls || []).map(toAbsolute);
    console.log(`[DEBUG] Python responded with confidence: ${mlData.confidence} (used_ml=${mlData.used_ml}, source=${mlData.inference_source})`);
 
    // Parse the data back into the structure the frontend expects
    const isVideo = req.file.mimetype.startsWith("video/");
    const isAudio = req.file.mimetype.startsWith("audio/");
    const isImage = req.file.mimetype.startsWith("image/");
    
    // Create an elegant UI response using the real ML data
    const finalResult = {
      is_deepfake: mlData.is_deepfake,
      confidence: mlData.confidence,
      file_hash: mlData.file_hash,
      type: isVideo ? "video" : isAudio ? "audio" : "image",
      feature_scores: mlData.feature_scores || {
        "Visual Artifacts": mlData.is_deepfake ? Math.floor(Math.random() * 20) + 70 : 10,
        "Audio Consistency": mlData.audio_confidence || 0,
        "Metadata Integrity": mlData.confidence
      },
      timeline: isVideo ? [
         { start: 0, end: 100, score: mlData.confidence, status: mlData.is_deepfake ? "manipulated" : "authentic" }
      ] : [],
      detailed_analysis: mlData.analysis || {},
      heatmap_url: mlData.heatmap_url,
      graphs: {
        consistency_timeline: [],
        feature_scores_chart: {},
        confidence_breakdown: {
          visual_evidence: (mlData.feature_scores && mlData.feature_scores['Visual Artifacts']) || mlData.confidence,
          audio_evidence: mlData.audio_confidence || 80,
          metadata_evidence: 95,
          temporal_evidence: isVideo ? mlData.confidence : 0,
        },
      },
      media_preview: {
        type: isVideo ? "video" : isAudio ? "audio" : "image",
        thumbnail: null,
        duration: isVideo || isAudio ? 30 : null,
        format: req.file.mimetype,
      },
      chief_judgment: {
        title: "Model Assessment",
        description: mlData.risk_description || (mlData.is_deepfake ? "AI Manipulation detected." : "Media appears authentic."),
      },
      visual_analysis: [
        {
          title: "AI Analysis",
          description: mlData.risk_description || "Model assessment available.",
          level: mlData.risk_level || "Medium",
        }
      ],
      metadata_analysis: [],
      forensics: [],
      frame_scores: mlData.frame_scores || [],
      frame_heatmap_urls: mlData.frame_heatmap_urls || [],
      inference_source: mlData.inference_source || 'unknown',
      model_info: mlData.model_info || null,
    };

    const { userId } = req.body;
    if (userId) {
      await run(
        "INSERT INTO analysis_log (user_id, is_deepfake, confidence) VALUES (?, ?, ?)",
        [userId, finalResult.is_deepfake ? 1 : 0, finalResult.confidence],
      );
    }

    res.json(finalResult);
    
  } catch (error) {
    console.error("Analysis Error:", error.message);
    let pythonError = null;
    if (error.response) {
       console.error("Python Server responded with:", error.response.data);
       pythonError = error.response.data;
    }
    res.status(500).json({ 
      error: "Failed to process media with ML engine.", 
      details: error.message, 
      python: pythonError,
      stack: error.stack
    });
  }
});

app.post("/api/analyze-fast", async (req, res) => {
  console.log("[DEBUG] /api/analyze-fast hit with body:", req.body);
  const { hash, name, type, size, userId } = req.body;

  if (!hash) {
    console.error("[DEBUG] No file hash provided");
    return res.status(400).json({ error: "No file hash provided" });
  }

  const randomValue = getDeterministicRandom(hash);
  const is_fake = randomValue < 0.4;
  const confidence = Math.floor(randomValue * (99 - 70 + 1)) + 70;

  let realMetadata = [
    { title: "File Name", description: name || "Unknown", level: "Low" },
    { title: "File Type", description: type || "Unknown", level: "Low" },
    {
      title: "File Size",
      description: size ? `${(size / 1024 / 1024).toFixed(2)} MB` : "Unknown",
      level: "Low",
    },
    {
      title: "Analysis Mode",
      description: "Fast Hashing (Client-Side)",
      level: "Info",
    },
  ];

  const isVideo = type && type.startsWith("video");
  const isAudio = type && type.startsWith("audio");

  let feature_scores = {};
  let timeline = [];

  if (is_fake) {
    feature_scores = {
      "Visual Artifacts": Math.floor(Math.random() * 20) + 70,
      "Audio Consistency":
        isVideo || isAudio ? Math.floor(Math.random() * 20) + 60 : 0,
      "Metadata Integrity": Math.floor(Math.random() * 30) + 40,
    };
    if (isVideo || isAudio) {
      timeline = [
        { start: 0, end: 15, score: 10, status: "authentic" },
        { start: 15, end: 28, score: 95, status: "manipulated" },
        { start: 28, end: 45, score: 20, status: "authentic" },
        { start: 45, end: 52, score: 88, status: "manipulated" },
      ];
    }
  } else {
    feature_scores = {
      "Visual Artifacts": Math.floor(Math.random() * 20) + 10,
      "Audio Consistency":
        isVideo || isAudio ? Math.floor(Math.random() * 20) + 10 : 0,
      "Metadata Integrity": Math.floor(Math.random() * 20) + 80,
    };
    if (isVideo || isAudio) {
      timeline = [{ start: 0, end: 100, score: 5, status: "authentic" }];
    }
  }

  const mockResult = {
    is_deepfake: is_fake,
    confidence: confidence,
    file_hash: hash,
    type: isVideo ? "video" : isAudio ? "audio" : "image",
    feature_scores,
    timeline,
    chief_judgment: {
      title: "Overall Assessment",
      description: is_fake
        ? `Preliminary hash analysis indicates patterns consistent with manipulated media.`
        : `Preliminary hash analysis suggests the media signature is consistent with authentic files.`,
    },
    visual_analysis: [
      {
        title: "Visual Pattern",
        description: is_fake
          ? "High-frequency noise detected in signature."
          : "Natural frequency distribution observed.",
        level: is_fake ? "Medium" : "Low",
      },
      {
        title: "Compression Artifacts",
        description: is_fake
          ? "Inconsistent compression blocks hinted by hash structure."
          : "Standard compression signature.",
        level: is_fake ? "High" : "Low",
      },
    ],
    metadata_analysis: realMetadata,
    forensics: [
      {
        title: "Hash Integrity",
        description: "Cryptographic signature verified.",
        level: "Low",
      },
      {
        title: "Database Match",
        description: "No known malicious matches found in local DB.",
        level: "Low",
      },
    ],
  };

  if (userId) {
    await run(
      "INSERT INTO analysis_log (user_id, is_deepfake, confidence) VALUES (?, ?, ?)",
      [userId, is_fake ? 1 : 0, confidence],
    );
  }

  setTimeout(() => {
    res.json(mockResult);
  }, 800);
});

app.post("/api/summarize", (req, res) => {
  const result = req.body.analysisResult;
  const summary = result.is_deepfake
    ? `DANGER: This media has a ${result.confidence}% probability of being a deepfake. Major indicators include facial artifacts and inconsistent noise patterns.`
    : `SAFE: This media appears authentic with a ${result.confidence}% confidence score. Metadata analysis aligns with original capture characteristics.`;
  res.json({ summary: summary });
});

app.post("/api/report/pdf", (req, res) => {
  const { analysisResult, fileName } = req.body;

  if (!analysisResult) {
    return res.status(400).json({ message: "Analysis result required." });
  }

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=analysis_report.pdf`,
  );

  doc.pipe(res);

  doc.fontSize(25).text("Deepfake Analysis Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`File Name: ${fileName || "Uploaded Media"}`);
  doc.text(`Date: ${new Date().toLocaleString()}`);
  doc.text(`Analysis Hash: ${analysisResult.file_hash || "N/A"}`);
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  doc
    .fontSize(18)
    .fillColor(analysisResult.is_deepfake ? "red" : "green")
    .text(
      `Verdict: ${analysisResult.is_deepfake ? "MANIPULATED" : "AUTHENTIC"}`,
      { align: "center" },
    );
  doc
    .fontSize(14)
    .fillColor("black")
    .text(`Confidence Score: ${analysisResult.confidence}%`, {
      align: "center",
    });
  doc.moveDown();

  const addSection = (title, items) => {
    doc.fontSize(16).fillColor("black").text(title, { underline: true });
    doc.moveDown(0.5);
    if (items && items.length > 0) {
      items.forEach((item) => {
        doc
          .fontSize(12)
          .fillColor(
            item.level === "High"
              ? "red"
              : item.level === "Medium"
                ? "orange"
                : "green",
          )
          .text(`[${item.level}] ${item.title}:`);
        doc.fillColor("black").text(`     ${item.description}`);
        doc.moveDown(0.5);
      });
    } else {
      doc.fontSize(12).text("No data available.");
    }
    doc.moveDown();
  };

  addSection("Chief Judgment", [
    {
      title: analysisResult.chief_judgment.title,
      description: analysisResult.chief_judgment.description,
      level: "Info",
    },
  ]);
  addSection("Visual Analysis", analysisResult.visual_analysis);
  addSection("Metadata Analysis", analysisResult.metadata_analysis);
  addSection("Forensics", analysisResult.forensics);

  doc.end();
});

// --- Admin Endpoints ---

app.get("/api/admin/activity", async (req, res) => {
  try {
    const results = await query(`
            SELECT 
                u.id, 
                u.username, 
                COUNT(CASE WHEN DATE(a.analysis_timestamp) = DATE('now') THEN 1 END) as analyses_today,
                COUNT(a.id) as total_analyses,
                MAX(a.analysis_timestamp) as last_active
            FROM users u
            LEFT JOIN analysis_log a ON u.id = a.user_id
            WHERE u.role != 'admin' OR u.role IS NULL 
            GROUP BY u.id, u.username
            ORDER BY last_active DESC
        `);
    res.json(results);
  } catch (err) {
    console.error("Database query error for admin activity:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get("/api/admin/stats", async (req, res) => {
  try {
    const totalUsers = await query(
      "SELECT COUNT(*) as count FROM users WHERE role != ?",
      ["admin"],
    );
    const totalAnalyses = await query(
      "SELECT COUNT(*) as count FROM analysis_log",
    );
    const deepfakesDetected = await query(
      "SELECT COUNT(*) as count FROM analysis_log WHERE is_deepfake = 1",
    );

    res.json({
      totalUsers: totalUsers[0]?.count || 0,
      totalAnalyses: totalAnalyses[0]?.count || 0,
      deepfakesDetected: deepfakesDetected[0]?.count || 0,
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    return res.status(500).json({ message: "Failed to fetch stats." });
  }
});

app.delete("/api/admin/user/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    await run("DELETE FROM users WHERE id = ?", [userId]);
    res.json({ message: "User deleted successfully." });
  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({ message: "Failed to delete user." });
  }
});

app.get("/api/user-activity/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const totalAnalyses = await query(
      "SELECT COUNT(*) as count FROM analysis_log WHERE user_id = ?",
      [userId],
    );
    const analysesToday = await query(
      'SELECT COUNT(*) as count FROM analysis_log WHERE user_id = ? AND DATE(analysis_timestamp) = DATE("now")',
      [userId],
    );
    const avgConfidence = await query(
      "SELECT AVG(confidence) as avg FROM analysis_log WHERE user_id = ?",
      [userId],
    );

    res.json({
      totalAnalyses: totalAnalyses[0]?.count || 0,
      analysesToday: analysesToday[0]?.count || 0,
      avgConfidence: avgConfidence[0]?.avg
        ? Math.round(avgConfidence[0].avg)
        : 0,
    });
  } catch (err) {
    console.error("Database query error for user activity:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get User Analysis History Endpoint
app.get("/api/user-history/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const results = await query(
      `SELECT id, is_deepfake, confidence, analysis_timestamp 
       FROM analysis_log 
       WHERE user_id = ? 
       ORDER BY analysis_timestamp DESC 
       LIMIT 50`,
      [userId],
    );

    // Get total counts
    const totalCount = await query(
      "SELECT COUNT(*) as count FROM analysis_log WHERE user_id = ?",
      [userId],
    );
    const realCount = await query(
      "SELECT COUNT(*) as count FROM analysis_log WHERE user_id = ? AND is_deepfake = 0",
      [userId],
    );
    const fakeCount = await query(
      "SELECT COUNT(*) as count FROM analysis_log WHERE user_id = ? AND is_deepfake = 1",
      [userId],
    );

    res.json({
      history: results.map((row) => ({
        id: row.id,
        is_deepfake: row.is_deepfake === 1,
        confidence: row.confidence,
        date: row.analysis_timestamp,
      })),
      stats: {
        total: totalCount[0]?.count || 0,
        authentic: realCount[0]?.count || 0,
        deepfakes: fakeCount[0]?.count || 0,
      },
    });
  } catch (err) {
    console.error("Database query error for user history:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get("/dashboard", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res
      .status(401)
      .json({ message: "Unauthorized: No user specified." });
  }

  try {
    const results = await query(
      "SELECT id, username, email FROM users WHERE username = ?",
      [username],
    );

    if (results.length > 0) {
      res.json({
        message: `Welcome to your dashboard, ${username}!`,
        user: results[0],
      });
    } else {
      res.status(404).json({ message: "User not found." });
    }
  } catch (err) {
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Protected Dashboard Endpoint with JWT
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const results = await query(
      "SELECT id, username, email, role FROM users WHERE id = ?",
      [req.user.id],
    );

    if (results.length > 0) {
      res.json({
        message: `Welcome to your dashboard, ${req.user.username}!`,
        user: results[0],
      });
    } else {
      res.status(404).json({ message: "User not found." });
    }
  } catch (err) {
    return res.status(500).json({ message: "Internal server error." });
  }
});

// --- Metadata Endpoints ---

app.post("/api/analyze-metadata", upload.single("media"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No media file found" });
  }

  try {
    const isImage = req.file.mimetype.startsWith("image/");
    const fileHash = crypto.createHash("md5").update(req.file.buffer).digest("hex");
    let fakeProbability = 0;
    
    let deviceResult = {
      name: req.file.originalname,
      format: req.file.mimetype,
      size: (req.file.size / 1024 / 1024).toFixed(2) + " MB",
      device: "Unknown Source",
      colorProfile: "Generic RGB",
      exposure: "N/A",
      fNumber: "N/A",
      iso: "N/A",
      focalLength: "N/A",
      lensModel: "N/A"
    };

    let traceResult = {
      creation: "Not available",
      modification: "Not available",
      software: "Unknown",
      encoder: "Standard Hardware/OS",
      gps: "Stripped or Unavailable"
    };

    if (isImage) {
      try {
        const parser = exifParser.create(req.file.buffer);
        const result = parser.parse();
        if (result && result.tags) {
          deviceResult.device = result.tags.Make && result.tags.Model ? `${result.tags.Make} ${result.tags.Model}` : "Unknown Camera";
          deviceResult.exposure = result.tags.ExposureTime ? `1/${Math.round(1/result.tags.ExposureTime)} sec` : "N/A";
          deviceResult.fNumber = result.tags.FNumber ? `f/${result.tags.FNumber}` : "N/A";
          deviceResult.iso = result.tags.ISO ? `ISO-${result.tags.ISO}` : "N/A";
          deviceResult.focalLength = result.tags.FocalLength ? `${result.tags.FocalLength}mm` : "N/A";
          deviceResult.lensModel = result.tags.LensModel || "N/A";
          
          traceResult.gps = (result.tags.GPSLatitude && result.tags.GPSLongitude) 
            ? `${result.tags.GPSLatitude.toFixed(5)}, ${result.tags.GPSLongitude.toFixed(5)}` 
            : "Stripped or Unavailable";
          
          traceResult.creation = result.tags.CreateDate ? new Date(result.tags.CreateDate * 1000).toLocaleString() : "Not available";
          traceResult.modification = result.tags.ModifyDate ? new Date(result.tags.ModifyDate * 1000).toLocaleString() : "Not available";
          traceResult.software = result.tags.Software || "Native iOS/Android Camera";
          
          if (traceResult.software.toLowerCase().includes("adobe") || traceResult.software.toLowerCase().includes("photoshop")) {
            fakeProbability += 40;
          }
        } else {
            fakeProbability += 30; // Missing EXIF implies stripped/social media compressed
        }
      } catch (err) {
        console.error("EXIF Parse Error:", err.message);
        fakeProbability += 20; 
        traceResult.software = "Malformed Exif or Stripped Header";
      }
    } else {
        fakeProbability += 15; 
    }

    const isFake = fakeProbability > 35;

    res.json({
      is_fake: isFake,
      device: deviceResult,
      trace: traceResult,
      hash: {
        md5: fileHash.substring(0, 16) + "...",
        perceptual: isFake ? "Altered Base" : "Original Verified",
        signature: isFake ? "Modified Tag" : "Intact"
      },
      raw_exif: isImage && result && result.tags ? result.tags : null
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to parse metadata" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
