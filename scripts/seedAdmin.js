const db = require("./backend/config/db");
const bcrypt = require("bcrypt");

async function seedAdmin() {
  try {
    const email = "migeroro@gmail.com";
    const password = "12345";
    const name = "Miger Admin";
    const role = "admin";

    // Check if exists
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      console.log("Admin already exists. Updating password...");
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query("UPDATE users SET password = ?, role = ? WHERE email = ?", [hashedPassword, role, email]);
      console.log("Admin password updated!");
    } else {
      console.log("Creating new admin user...");
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query("INSERT INTO users (role, name, email, password) VALUES (?, ?, ?, ?)", [role, name, email, hashedPassword]);
      console.log("Admin created successfully!");
    }

    process.exit(0);

  } catch (err) {
    console.error("Error seeding admin:", err);
    process.exit(1);
  }
}

seedAdmin();
