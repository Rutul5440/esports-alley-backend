const express = require("express");
const router = express.Router();
const { uploadClip, toggleLike, addComment, getClip } = require("../controllers/clip.controller");
const { protect } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");

router.get("/:clipId", getClip);
router.post("/", protect, upload.fields([{ name: "clip", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), uploadClip);
router.post("/:clipId/like", protect, toggleLike);
router.post("/:clipId/comment", protect, addComment);

module.exports = router;