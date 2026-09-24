const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { s3, BUCKET, publicUrl } = require("../s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ---- Tree management (grades/chapters/sections) ----
router.get("/majors", async (req, res) => {
  res.json((await pool.query("SELECT * FROM majors ORDER BY id")).rows);
});

router.post("/majors/:majorId/grades", async (req, res) => {
  const { title, imageObjectKey } = req.body || {};
  const r = await pool.query(
    "INSERT INTO grades (major_id, title, image_object_key) VALUES ($1,$2,$3) RETURNING *",
    [req.params.majorId, title, imageObjectKey || null]
  );
  res.json(r.rows[0]);
});
router.patch("/grades/:id", async (req, res) => {
  const { title, imageObjectKey } = req.body || {};
  const r = await pool.query(
    "UPDATE grades SET title=COALESCE($1,title), image_object_key=COALESCE($2,image_object_key) WHERE id=$3 RETURNING *",
    [title || null, imageObjectKey || null, req.params.id]
  );
  res.json(r.rows[0]);
});
router.delete("/grades/:id", async (req, res) => {
  await pool.query("DELETE FROM grades WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

router.post("/grades/:gradeId/chapters", async (req, res) => {
  const { title, imageObjectKey } = req.body || {};
  const r = await pool.query(
    "INSERT INTO chapters (grade_id, title, image_object_key) VALUES ($1,$2,$3) RETURNING *",
    [req.params.gradeId, title, imageObjectKey || null]
  );
  res.json(r.rows[0]);
});
router.patch("/chapters/:id", async (req, res) => {
  const { title, imageObjectKey } = req.body || {};
  const r = await pool.query(
    "UPDATE chapters SET title=COALESCE($1,title), image_object_key=COALESCE($2,image_object_key) WHERE id=$3 RETURNING *",
    [title || null, imageObjectKey || null, req.params.id]
  );
  res.json(r.rows[0]);
});
router.delete("/chapters/:id", async (req, res) => {
  await pool.query("DELETE FROM chapters WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

router.post("/chapters/:chapterId/sections", async (req, res) => {
  const { title, imageObjectKey } = req.body || {};
  const r = await pool.query(
    "INSERT INTO sections (chapter_id, title, image_object_key) VALUES ($1,$2,$3) RETURNING *",
    [req.params.chapterId, title, imageObjectKey || null]
  );
  res.json(r.rows[0]);
});
router.patch("/sections/:id", async (req, res) => {
  const { title, imageObjectKey } = req.body || {};
  const r = await pool.query(
    "UPDATE sections SET title=COALESCE($1,title), image_object_key=COALESCE($2,image_object_key) WHERE id=$3 RETURNING *",
    [title || null, imageObjectKey || null, req.params.id]
  );
  res.json(r.rows[0]);
});
router.delete("/sections/:id", async (req, res) => {
  await pool.query("DELETE FROM sections WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

router.get("/tree", async (req, res) => {
  const grades = (await pool.query("SELECT * FROM grades ORDER BY id")).rows;
  const chapters = (await pool.query("SELECT * FROM chapters ORDER BY id")).rows;
  const sections = (await pool.query("SELECT * FROM sections ORDER BY id")).rows;
  const clips = (await pool.query("SELECT * FROM clips ORDER BY id")).rows;
  res.json({ grades, chapters, sections, clips });
});

// ---- File upload ----
router.post("/upload-url", async (req, res) => {
  const { fileName, contentType, public: isPublic } = req.body || {};
  if (!fileName) return res.status(400).json({ error: "fileName لازم است" });
  const safeName = fileName.replace(/[^\w.\-]+/g, "_");
  const folder = isPublic ? "public" : "clips";
  const objectKey = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`;
  const commandParams = {
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: contentType || "application/octet-stream"
  };
  if (isPublic) commandParams.ACL = "public-read";
  const command = new PutObjectCommand(commandParams);
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
  res.json({ uploadUrl, objectKey, publicUrl: isPublic ? publicUrl(objectKey) : null });
});

// ---- Clips CRUD ----
router.post("/clips", async (req, res) => {
  const { sectionId, title, duration, price, isFree, description, previewObjectKey, fullObjectKey, pdfObjectKey } = req.body || {};
  if (!sectionId || !title || !previewObjectKey || !fullObjectKey) {
    return res.status(400).json({ error: "sectionId، title، previewObjectKey و fullObjectKey لازم است" });
  }
  const r = await pool.query(
    `INSERT INTO clips (section_id, title, duration, price, is_free, description, preview_object_key, full_object_key, pdf_object_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [sectionId, title, duration || null, isFree ? 0 : (price || 0), !!isFree, description || null, previewObjectKey, fullObjectKey, pdfObjectKey || null]
  );
  res.json(r.rows[0]);
});

// Edit an existing clip. File keys are optional — only send them if the admin re-uploaded that file;
// anything omitted (null/undefined) keeps its previous value.
router.put("/clips/:id", async (req, res) => {
  const { title, duration, price, isFree, description, previewObjectKey, fullObjectKey, pdfObjectKey } = req.body || {};
  const r = await pool.query(
    `UPDATE clips SET
       title=COALESCE($1,title),
       duration=COALESCE($2,duration),
       price=CASE WHEN $4::boolean IS TRUE THEN 0 ELSE COALESCE($3,price) END,
       is_free=COALESCE($4,is_free),
       description=COALESCE($5,description),
       preview_object_key=COALESCE($6,preview_object_key),
       full_object_key=COALESCE($7,full_object_key),
       pdf_object_key=COALESCE($8,pdf_object_key)
     WHERE id=$9 RETURNING *`,
    [
      title || null,
      duration || null,
      typeof price === "number" ? price : null,
      typeof isFree === "boolean" ? isFree : null,
      description || null,
      previewObjectKey || null,
      fullObjectKey || null,
      pdfObjectKey || null,
      req.params.id
    ]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "کلیپ پیدا نشد" });
  res.json(r.rows[0]);
});

router.delete("/clips/:id", async (req, res) => {
  await pool.query("DELETE FROM clips WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
