const express = require("express");
const pool = require("../db");
const { optionalAuth, requireAuth } = require("../middleware/auth");
const { getSignedDownloadUrl, publicUrl } = require("../s3");

const router = express.Router();

// Full catalog tree. If the request has a valid token, each clip includes "owned".
router.get("/catalog", optionalAuth, async (req, res) => {
  try {
    const majors = (await pool.query("SELECT * FROM majors ORDER BY id")).rows;
    const grades = (await pool.query("SELECT * FROM grades ORDER BY sort_order, id")).rows;
    const chapters = (await pool.query("SELECT * FROM chapters ORDER BY sort_order, id")).rows;
    const sections = (await pool.query("SELECT * FROM sections ORDER BY sort_order, id")).rows;
    const clips = (await pool.query("SELECT * FROM clips ORDER BY sort_order, id")).rows;

    let ownedSet = new Set();
    if (req.user) {
      const owned = await pool.query("SELECT clip_id FROM purchases WHERE user_id=$1", [req.user.id]);
      ownedSet = new Set(owned.rows.map(r => r.clip_id));
    }

    const tree = majors.map(major => ({
      id: major.id,
      slug: major.slug,
      title: major.title,
      grades: grades.filter(g => g.major_id === major.id).map(grade => ({
        id: grade.id,
        title: grade.title,
        image: publicUrl(grade.image_object_key),
        chapters: chapters.filter(c => c.grade_id === grade.id).map(chapter => ({
          id: chapter.id,
          title: chapter.title,
          image: publicUrl(chapter.image_object_key),
          sections: sections.filter(s => s.chapter_id === chapter.id).map(section => ({
            id: section.id,
            title: section.title,
            image: publicUrl(section.image_object_key),
            clips: clips.filter(cl => cl.section_id === section.id).map(cl => ({
              id: cl.id,
              title: cl.title,
              description: cl.description,
              duration: cl.duration,
              price: cl.price,
              isFree: cl.is_free,
              hasPdf: !!cl.pdf_object_key,
              owned: cl.is_free || ownedSet.has(cl.id)
            }))
          }))
        }))
      }))
    }));

    res.json({ majors: tree });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطای سرور" });
  }
});

// Issue a short-lived signed download URL.
// type=preview is always allowed. type=full requires the clip to be free or purchased.
router.get("/clips/:id/download", optionalAuth, async (req, res) => {
  const clipId = Number(req.params.id);
  const type = req.query.type === "full" ? "full" : req.query.type === "pdf" ? "pdf" : "preview";
  try {
    const result = await pool.query("SELECT * FROM clips WHERE id=$1", [clipId]);
    if (result.rowCount === 0) return res.status(404).json({ error: "کلیپ پیدا نشد" });
    const clip = result.rows[0];

    if (type !== "preview" && !clip.is_free) {
      if (!req.user) return res.status(401).json({ error: "برای دانلود نسخهٔ کامل باید وارد شوید" });
      const owned = await pool.query(
        "SELECT 1 FROM purchases WHERE user_id=$1 AND clip_id=$2",
        [req.user.id, clipId]
      );
      if (owned.rowCount === 0) return res.status(403).json({ error: "این کلیپ را هنوز خریداری نکرده‌اید" });
    }

    const key = type === "full" ? clip.full_object_key
      : type === "pdf" ? clip.pdf_object_key
      : clip.preview_object_key;

    if (!key) return res.status(404).json({ error: "فایل موجود نیست" });

    const ext = key.includes(".") ? key.slice(key.lastIndexOf(".")) : "";
    const suffix = type === "full" ? "کامل" : type === "pdf" ? "جزوه" : "پیش‌نمایش";
    const filename = `${clip.title}-${suffix}${ext}`;

    const url = await getSignedDownloadUrl(key, 300, filename);
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطای سرور" });
  }
});

module.exports = router;
