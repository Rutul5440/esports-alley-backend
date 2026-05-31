const express = require("express");
const router = express.Router();
const {
  register,
  login,
  googleLogin,
  getMe,
  toggleFollow,
  checkUsername,
  completeProfile,
  updateGamePreferences,
  uploadAvatar,
  uploadBanner,
} = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/google-login", googleLogin);
router.get("/me", protect, getMe);
router.post("/follow/:userId", protect, toggleFollow);
router.post("/check-username", checkUsername);
router.put("/complete-profile", protect, completeProfile);
router.put("/game-preferences", protect, updateGamePreferences);
router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);
router.post("/banner", protect, upload.single("banner"), uploadBanner);

module.exports = router;
