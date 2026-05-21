const express = require("express");
const router = express.Router();
const {
  createOrganization,
  updateOrganization,
  getOrganization,
  recruiterDashboard,
  savePlayer,
  getSavedPlayers,
  verifyOrganization,
} = require("../controllers/organization.controller");
const { protect } = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/role.middleware");
const upload = require("../middlewares/upload.middleware");

// Org only
router.post(
  "/",
  protect,
  restrictTo("organization"),
  upload.single("logo"),
  createOrganization
);
router.put(
  "/",
  protect,
  restrictTo("organization"),
  upload.single("logo"),
  updateOrganization
);
router.get(
  "/dashboard/players",
  protect,
  restrictTo("organization"),
  recruiterDashboard
);
router.post(
  "/save-player/:playerId",
  protect,
  restrictTo("organization"),
  savePlayer
);
router.get(
  "/saved-players",
  protect,
  restrictTo("organization"),
  getSavedPlayers
);

// Admin only
router.patch(
  "/:orgId/verify",
  protect,
  restrictTo("admin"),
  verifyOrganization
);

// Public
router.get("/:orgId", getOrganization);

module.exports = router;
