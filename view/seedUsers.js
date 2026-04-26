const mongoose = require("mongoose");
require("dotenv").config();
const bcrypt = require("bcrypt");

// ====== SCHEMA ======
const userSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: { type: String, lowercase: true, trim: true },
  password: String,
  role: String,
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  lastLogin: { type: Date, default: null }
});

const User = mongoose.model("User", userSchema);

// ====== HELPER: Generate UserId ======
async function generateUserId(role) {
  let prefix = "";
  if (role === "Admin") prefix = "A";
  else if (role === "Doctor") prefix = "D";
  else if (role === "Nurse") prefix = "N";
  else if (role === "Medtech") prefix = "M";

  const count = await User.countDocuments({ role });
  const number = String(count + 1).padStart(3, "0"); // e.g. 001
  return `${prefix}${number}`;
}

// ====== SEED FUNCTION ======
const normalizeEmail = (email = "") => email.trim().toLowerCase();

async function seed() {
  await mongoose.connect("mongodb://localhost:27017/mediSysDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await User.deleteMany({}); // clear old users

  const users = [
    { name: "Admin User", email: "admin@gmail.com", password: "admin123", role: "Admin" },
    { name: "Tony Chopper", email: "doctor@gmail.com", password: "doctor123", role: "Doctor" },
    { name: "Jane Dimakita", email: "nurse@gmail.com", password: "nurse123", role: "Nurse" },
    { name: "Senku Stone", email: "medtech@gmail.com", password: "medtech123", role: "Medtech" }
  ];

  for (let u of users) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    u.password = hashedPassword;
    u.userId = await generateUserId(u.role); // auto-generate ID
    u.status = "Active";
    u.lastLogin = null;
    u.email = normalizeEmail(u.email);
    await User.create(u);
  }

  console.log("✅ Users seeded with hashed passwords, IDs, and status");
  mongoose.disconnect();
}

seed();