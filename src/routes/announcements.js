const express = require("express");
const pool = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Public: list announcements, newest first
router.get("/announcements", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC");
    res.json({ announcements: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطای سرور" });
  }
});

// Admin: create an announcement
router.post("/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "عنوان و متن خبر لازم است" });
  const result = await pool.query(
    "INSERT INTO announcements (title, body) VALUES ($1,$2) RETURNING *",
    [title, body]
  );
  res.json(result.rows[0]);
});

// Admin: delete an announcement
router.delete("/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM announcements WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
