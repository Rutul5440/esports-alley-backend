const express = require("express");
const router = express.Router();
const {
  addAchievement,
  getAchievements,
  deleteAchievement,
  verifyAchievement,
} = require("../controllers/achievement.controller");
const { protect } = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/role.middleware");
const upload = require("../middlewares/upload.middleware");

// Public
router.get("/:userId", getAchievements);

// Player only
router.post(
  "/",
  protect,
  restrictTo("player"),
  upload.single("proofImage"),
  addAchievement
);
router.delete(
  "/:achievementId",
  protect,
  restrictTo("player"),
  deleteAchievement
);

// Admin only
router.patch(
  "/:achievementId/verify",
  protect,
  restrictTo("admin"),
  verifyAchievement
);

module.exports = router;