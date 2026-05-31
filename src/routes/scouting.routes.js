const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/role.middleware");
const {
  searchPlayers,
  toggleSavePlayer,
  getSavedPlayers,
  upsertNote,
  invitePlayer,
} = require("../controllers/scouting.controller");

router.use(protect, restrictTo("organization"));
router.get("/players", searchPlayers);
router.post("/save/:playerId", toggleSavePlayer);
router.get("/saved", getSavedPlayers);
router.post("/note/:playerId", upsertNote);
router.put("/note/:playerId", upsertNote);
router.post("/invite/:playerId", invitePlayer);

module.exports = router;
