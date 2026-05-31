const express = require("express");
const router = express.Router();
const { createProfile, updateProfile, getProfile, trackProfileView, getTopPlayers, searchPlayers } = require("../controllers/profile.controller");
const { protect } = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/role.middleware");

// Public
router.get("/top", getTopPlayers);
router.get("/search", searchPlayers);
router.get("/:userId", getProfile);

// Protected
router.post("/", protect, restrictTo("player"), createProfile);
router.put("/", protect, restrictTo("player"), updateProfile);
router.post("/:userId/view", protect, trackProfileView);

module.exports = router;