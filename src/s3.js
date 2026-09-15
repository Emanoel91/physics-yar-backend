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

// Returns a temporary (time-limited) download URL for a private object.
async function getSignedDownloadUrl(objectKey, expiresInSeconds = 300) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: objectKey });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

module.exports = { s3, BUCKET, getSignedDownloadUrl };
