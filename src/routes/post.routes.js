const express = require("express");
const router = express.Router();
const {
  createPost,
  getFeed,
  getPost,
  updatePost,
  deletePost,
  getPostsByUser,
  getSavedPosts,
  togglePostLike,
  addPostComment,
  togglePostCommentLike,
  deletePostComment,
  toggleSavePost,
  sharePost,
  votePoll,
} = require("../controllers/post.controller");
const { protect } = require("../middlewares/auth.middleware");

router.post("/", protect, createPost);
router.get("/feed", protect, getFeed);
router.get("/saved", protect, getSavedPosts);
router.get("/user/:userId", protect, getPostsByUser);
router.get("/:id", protect, getPost);
router.put("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, togglePostLike);
router.post("/:id/comment", protect, addPostComment);
router.post("/:id/comment/:cid/like", protect, togglePostCommentLike);
router.delete("/:id/comment/:cid", protect, deletePostComment);
router.post("/:id/save", protect, toggleSavePost);
router.post("/:id/share", protect, sharePost);
router.post("/:id/poll/vote", protect, votePoll);

module.exports = router;
