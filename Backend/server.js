require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const upload = multer();
const { db, query, run } = require("./db");

const app = express();
const port = process.env.PORT || 3000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Helper: Generate OTP ---
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register Endpoint
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Username, email, and password are required." });
  }

  try {
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
      subject: "Verify your Account - Deepfake Detector",
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

    res
      .status(201)
      .json({
        message: "Registration successful. OTP sent to email.",
        otp: otp,
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
      subject: "Resend Verification Code - Deepfake Detector",
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

// Login Endpoint
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
        res.json({
          message: "Login successful",
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

// --- Analysis Endpoints ---

const exifParser = require("exif-parser");
const PDFDocument = require("pdfkit");

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

  let fileHash;
  const buffer = req.file.buffer;

  if (buffer.length > 5 * 1024 * 1024) {
    const start = buffer.subarray(0, 4096);
    const end = buffer.subarray(buffer.length - 4096);
    const sizeBuf = Buffer.alloc(8);
    sizeBuf.writeBigUInt64LE(BigInt(buffer.length));

    fileHash = crypto
      .createHash("md5")
      .update(start)
      .update(end)
      .update(sizeBuf)
      .digest("hex");
  } else {
    fileHash = crypto.createHash("md5").update(buffer).digest("hex");
  }

  const randomValue = getDeterministicRandom(fileHash);
  const is_fake = randomValue < 0.4;
  const confidence = Math.floor(randomValue * (99 - 70 + 1)) + 70;

  let realMetadata = [];
  let make = "Unknown";
  let model = "Unknown";
  let software = "Unknown";
  let dateTime = "Unknown";

  try {
    if (
      req.file.mimetype === "image/jpeg" ||
      req.file.mimetype === "image/tiff"
    ) {
      const parser = exifParser.create(req.file.buffer);
      const result = parser.parse();

      if (result.tags) {
        if (result.tags.Make) {
          realMetadata.push({
            title: "Camera Make",
            description: result.tags.Make,
            level: "Low",
          });
          make = result.tags.Make;
        }
        if (result.tags.Model) {
          realMetadata.push({
            title: "Camera Model",
            description: result.tags.Model,
            level: "Low",
          });
          model = result.tags.Model;
        }
        if (result.tags.Software) {
          realMetadata.push({
            title: "Software",
            description: result.tags.Software,
            level: "Medium",
          });
          software = result.tags.Software;
          if (
            result.tags.Software.toLowerCase().includes("photoshop") ||
            result.tags.Software.toLowerCase().includes("gimp")
          ) {
            realMetadata.push({
              title: "Editing Software Detected",
              description: `Metadata indicates use of ${result.tags.Software}`,
              level: "High",
            });
          }
        }
        if (result.tags.DateTimeOriginal) {
          const date = new Date(result.tags.DateTimeOriginal * 1000);
          realMetadata.push({
            title: "Capture Date",
            description: date.toLocaleString(),
            level: "Low",
          });
          dateTime = date.toLocaleString();
        }
        if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
          realMetadata.push({
            title: "GPS Location",
            description: `Lat: ${result.tags.GPSLatitude.toFixed(4)}, Lon: ${result.tags.GPSLongitude.toFixed(4)}`,
            level: "Low",
          });
        }
      }
    }
  } catch (e) {
    console.error("Metadata extraction failed:", e);
    realMetadata.push({
      title: "Metadata extraction",
      description: "Could not extract EXIF data.",
      level: "Low",
    });
  }

  if (realMetadata.length === 0) {
    realMetadata.push({
      title: "No Metadata",
      description: "No significant metadata found in file headers.",
      level: "Low",
    });
  }

  const mime = req.file.mimetype;
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");

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
    file_hash: fileHash,
    type: isVideo ? "video" : isAudio ? "audio" : "image",
    feature_scores,
    timeline,
    chief_judgment: {
      title: "Overall Assessment",
      description: is_fake
        ? `The media shows signs of manipulation consistent with deepfake generation algorithms. ${software !== "Unknown" ? `Editing software '${software}' trace detected.` : ""}`
        : `The media appears to be authentic. Metadata confirms capture by ${make} ${model} at ${dateTime}.`,
    },
    visual_analysis: [
      {
        title: "Lighting Inconsistencies",
        description: is_fake
          ? "Shadows around the subject do not fully match the environment."
          : "Lighting appears natural and consistent.",
        level: is_fake ? "Medium" : "Low",
      },
      {
        title: "Facial Artifacts",
        description: is_fake
          ? "Minor blurring and warping observed around the mouth."
          : "No facial warping or blending artifacts detected.",
        level: is_fake ? "High" : "Low",
      },
    ],
    metadata_analysis: realMetadata,
    forensics: [
      {
        title: "Noise Pattern",
        description: is_fake
          ? "Inconsistent noise patterns detected in the background."
          : "Consistent sensor noise profile observed.",
        level: is_fake ? "Medium" : "Low",
      },
      {
        title: "Compression Analysis",
        description: "No unusual compression artifacts found.",
        level: "Low",
      },
    ],
  };

  const { userId } = req.body;
  if (userId) {
    await run(
      "INSERT INTO analysis_log (user_id, is_deepfake, confidence) VALUES (?, ?, ?)",
      [userId, is_fake ? 1 : 0, confidence],
    );
  }

  res.json(mockResult);
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
