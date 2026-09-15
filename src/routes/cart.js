const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT c.id as clip_id, c.title, c.price, c.is_free
     FROM cart_items ci JOIN clips c ON c.id = ci.clip_id
     WHERE ci.user_id=$1 ORDER BY ci.created_at`,
    [req.user.id]
  );
  res.json({ items: result.rows });
});

router.post("/", async (req, res) => {
  const { clipId } = req.body || {};
  if (!clipId) return res.status(400).json({ error: "clipId لازم است" });
  await pool.query(
    "INSERT INTO cart_items (user_id, clip_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [req.user.id, clipId]
  );
  res.json({ ok: true });
});

router.delete("/:clipId", async (req, res) => {
  await pool.query("DELETE FROM cart_items WHERE user_id=$1 AND clip_id=$2", [req.user.id, req.params.clipId]);
  res.json({ ok: true });
});

module.exports = router;
