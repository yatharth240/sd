const express = require("express");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { randomUUID } = require("node:crypto");
const { ensureAuth } = require("../middleware/auth");
const router = express.Router();
const imageTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
let bucket;
router.get("/get/preSignedURL", ensureAuth, async (req, res, next) => {
  const contentType = req.query.contentType;
  if (!imageTypes[contentType] || typeof req.query.fileName !== "string") {
    return res.status(400).json({ error: "Choose a JPEG, PNG, WebP, or GIF image" });
  }
  if (!process.env.AWS_REGION || !process.env.S3_BUCKET || !process.env.S3_PUBLIC_BASE_URL ||
      !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return res.status(503).json({ error: "Image uploads are not configured" });
  }
  try {
    bucket ||= new S3Client({ region: process.env.AWS_REGION });
    const fileName = req.user.id + "-" + randomUUID() + "." + imageTypes[contentType];
    const command = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: fileName, ContentType: contentType });
    const url = await getSignedUrl(bucket, command, { expiresIn: 300 });
    const publicUrl = process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "") + "/" + fileName;
    res.set("Cache-Control", "no-store").json({ url, fileName, publicUrl });
  } catch (error) { next(error); }
});
module.exports = router;
