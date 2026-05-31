const express = require("express");
const router = express.Router();
const { getLeaderboard, getScrimLeaderboard } = require("../controllers/leaderboard.controller");

// Public endpoints
router.get("/", getLeaderboard);
router.get("/scrims", getScrimLeaderboard);

module.exports = router;
