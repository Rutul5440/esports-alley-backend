const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  unreadCount,
} = require("../controllers/notification.controller");

router.get("/", protect, getNotifications);
router.get("/unread-count", protect, unreadCount);
router.patch("/read-all", protect, markAllRead);
router.patch("/:id/read", protect, markRead);
router.delete("/:id", protect, deleteNotification);

module.exports = router;
