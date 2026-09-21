const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "ir-thr-at1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  },
  forcePathStyle: true
});

const BUCKET = process.env.S3_BUCKET;
// Permanent, public URL base for public-read objects (thumbnails, banners) — no signing needed.
const PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL || `${process.env.S3_ENDPOINT}/${BUCKET}`;

function publicUrl(objectKey) {
  return objectKey ? `${PUBLIC_BASE_URL}/${objectKey}` : null;
}

// Returns a temporary (time-limited) download URL for a private object.
// filename, if given, forces the browser to download (not just open) the file with that name.
async function getSignedDownloadUrl(objectKey, expiresInSeconds = 300, filename = null) {
  const params = { Bucket: BUCKET, Key: objectKey };
  if (filename) {
    params.ResponseContentDisposition = `attachment; filename="${encodeURIComponent(filename)}"`;
  }
  const command = new GetObjectCommand(params);
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

module.exports = { s3, BUCKET, getSignedDownloadUrl, publicUrl };
