const express = require("express");
const router = express.Router();
const {
  getCommunityItems,
  getCommunityItem,
  createCommunityItem,
  updateCommunityItem,
  deleteCommunityItem,
  joinCommunityItem,
  leaveCommunityItem,
} = require("../controllers/community.controller");
const { protect } = require("../middlewares/auth.middleware");

router.get("/", protect, getCommunityItems);
router.get("/:id", protect, getCommunityItem);
router.post("/", protect, createCommunityItem);
router.put("/:id", protect, updateCommunityItem);
router.delete("/:id", protect, deleteCommunityItem);
router.post("/:id/join", protect, joinCommunityItem);
router.post("/:id/leave", protect, leaveCommunityItem);

module.exports = router;
