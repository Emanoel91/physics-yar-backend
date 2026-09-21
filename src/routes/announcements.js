const express = require("express");
const pool = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { publicUrl } = require("../s3");

const router = express.Router();

function withImage(row) {
  return { ...row, imageUrl: publicUrl(row.image_object_key) };
}

// Public: list announcements — pinned first, then newest first
router.get("/announcements", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC"
    );
    res.json({ announcements: result.rows.map(withImage) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطای سرور" });
  }
});

// Admin: create an announcement
router.post("/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
  const { title, body, imageObjectKey, isPinned } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "عنوان و متن خبر لازم است" });
  const result = await pool.query(
    "INSERT INTO announcements (title, body, image_object_key, is_pinned) VALUES ($1,$2,$3,$4) RETURNING *",
    [title, body, imageObjectKey || null, !!isPinned]
  );
  res.json(withImage(result.rows[0]));
});

// Admin: edit an announcement
router.put("/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  const { title, body, imageObjectKey, isPinned } = req.body || {};
  const result = await pool.query(
    `UPDATE announcements SET
       title=COALESCE($1,title),
       body=COALESCE($2,body),
       image_object_key=COALESCE($3,image_object_key),
       is_pinned=COALESCE($4,is_pinned)
     WHERE id=$5 RETURNING *`,
    [title || null, body || null, imageObjectKey || null, typeof isPinned === "boolean" ? isPinned : null, req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "خبر پیدا نشد" });
  res.json(withImage(result.rows[0]));
});

// Admin: delete an announcement
router.delete("/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM announcements WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
