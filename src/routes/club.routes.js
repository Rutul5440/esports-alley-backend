const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  createClub,
  listClubs,
  getClub,
  updateClub,
  deleteClub,
  joinClub,
  leaveClub,
  listMembers,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleAttend,
  createClubPost,
  getClubPosts,
} = require("../controllers/club.controller");

router.post("/", protect, createClub);
router.get("/", protect, listClubs);
router.get("/:id", protect, getClub);
router.put("/:id", protect, updateClub);
router.delete("/:id", protect, deleteClub);
router.post("/:id/join", protect, joinClub);
router.post("/:id/leave", protect, leaveClub);
router.get("/:id/members", protect, listMembers);
router.post("/:id/events", protect, createEvent);
router.put("/:id/events/:eid", protect, updateEvent);
router.delete("/:id/events/:eid", protect, deleteEvent);
router.post("/:id/events/:eid/attend", protect, toggleAttend);
router.post("/:id/posts", protect, createClubPost);
router.get("/:id/posts", protect, getClubPosts);

module.exports = router;
