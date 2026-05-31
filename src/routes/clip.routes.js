const express = require("express");
const router = express.Router();
const {
  getAllClips,
  getUserClips,
  uploadClip,
  getClip,
  updateClip,
  deleteClip,
  toggleLike,
  addComment,
  deleteComment,
} = require("../controllers/clip.controller");
const { protect } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");

// Public
router.get("/", getAllClips);
router.get("/user/:userId", getUserClips);
router.get("/:clipId", getClip);

// Protected
router.post("/", protect, upload.fields([{ name: "clip", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), uploadClip);
router.put("/:clipId", protect, updateClip);
router.delete("/:clipId", protect, deleteClip);
router.post("/:clipId/like", protect, toggleLike);
router.post("/:clipId/comment", protect, addComment);
router.delete("/:clipId/comment/:commentId", protect, deleteComment);

module.exports = router;