const express = require("express");
const router = express.Router();
const { createProfile, updateProfile, getProfile, searchPlayers } = require("../controllers/profile.controller");
const { protect } = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/role.middleware");

router.get("/search", searchPlayers);
router.get("/:userId", getProfile);
router.post("/", protect, restrictTo("player"), createProfile);
router.put("/", protect, restrictTo("player"), updateProfile);

module.exports = router;