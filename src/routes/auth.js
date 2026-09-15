const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { fullName, phone, password } = req.body || {};
  if (!fullName || !phone || !password) {
    return res.status(400).json({ error: "نام، شماره موبایل و رمز عبور لازم است" });
  }
  try {
    const existing = await pool.query("SELECT id FROM users WHERE phone=$1", [phone]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "این شماره موبایل قبلاً ثبت‌نام کرده است" });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (full_name, phone, password_hash) VALUES ($1,$2,$3) RETURNING id, full_name, phone, is_admin",
      [fullName, phone, hash]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطای سرور" });
  }
});

router.post("/login", async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) {
    return res.status(400).json({ error: "شماره موبایل و رمز عبور لازم است" });
  }
  try {
    const result = await pool.query("SELECT * FROM users WHERE phone=$1", [phone]);
    if (result.rowCount === 0) return res.status(401).json({ error: "شماره موبایل یا رمز اشتباه است" });
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "شماره موبایل یا رمز اشتباه است" });
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطای سرور" });
  }
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, isAdmin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function publicUser(user) {
  return { id: user.id, fullName: user.full_name, phone: user.phone, isAdmin: user.is_admin };
}

module.exports = router;
