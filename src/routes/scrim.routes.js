const express = require("express");
const router = express.Router();
const {
  getScrims,
  getScrim,
  createScrim,
  updateScrim,
  deleteScrim,
  registerForScrim,
  updateRegistration,
  submitResults,
  getAnalytics,
  getMyScrims,
  getRegisteredScrims,
} = require("../controllers/scrim.controller");
const { protect } = require("../middlewares/auth.middleware");

router.get("/", protect, getScrims);
router.post("/", protect, createScrim);
router.get("/my", protect, getMyScrims);
router.get("/registered", protect, getRegisteredScrims);
router.get("/:id", protect, getScrim);
router.put("/:id", protect, updateScrim);
router.delete("/:id", protect, deleteScrim);
router.post("/:id/register", protect, registerForScrim);
router.put("/:id/registrations/:rid", protect, updateRegistration);
router.post("/:id/results", protect, submitResults);
router.get("/:id/analytics", protect, getAnalytics);

module.exports = router;
