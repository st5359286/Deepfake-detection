require("dotenv").config();
const bcrypt = require("bcryptjs");
const { db, run, query } = require("./db");

async function createTestUser() {
  try {
    // Check if test user already exists
    const existing = await query("SELECT * FROM users WHERE username = ?", [
      "testuser",
    ]);

    if (existing.length > 0) {
      console.log("Test user already exists!");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("test123", 10);

    // Insert test user (verified = 1, role = user)
    await run(
      "INSERT INTO users (username, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)",
      ["testuser", "test@example.com", hashedPassword, "user", 1],
    );

    console.log("✅ Test user created successfully!");
    console.log("   Username: testuser");
    console.log("   Password: test123");
    console.log("   Email: test@example.com");
    console.log("   Status: Verified (can login immediately)");
  } catch (error) {
    console.error("Error creating test user:", error);
  }

  process.exit();
}

createTestUser();
