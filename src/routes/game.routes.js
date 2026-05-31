const express = require("express");
const router = express.Router();
const { listGames, getGame, addGame, updateGame } = require("../controllers/game.controller");
const { protect } = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/role.middleware");

// Public
router.get("/", listGames);
router.get("/:gameId", getGame);

// Admin only
router.post("/", protect, restrictTo("admin"), addGame);
router.put("/:gameId", protect, restrictTo("admin"), updateGame);

module.exports = router;
