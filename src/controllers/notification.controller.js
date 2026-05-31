const Notification = require("../models/Notification.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const getNotifications = asyncHandler(async (req, res) => {
  const { unreadOnly = "false", limit = 30 } = req.query;
  const filter = { recipient: req.user._id };
  if (unreadOnly === "true") filter.isRead = false;

  const notifications = await Notification.find(filter)
    .populate("sender", "username avatar role")
    .sort({ createdAt: -1 })
    .limit(Math.min(parseInt(limit), 100));

  return res.status(200).json(new ApiResponse(200, notifications, "Notifications fetched"));
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notification) throw new ApiError(404, "Notification not found.");
  return res.status(200).json(new ApiResponse(200, notification, "Notification marked read"));
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true } });
  return res.status(200).json(new ApiResponse(200, null, "All notifications marked read"));
});

const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  if (!notification) throw new ApiError(404, "Notification not found.");
  return res.status(200).json(new ApiResponse(200, null, "Notification deleted"));
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  return res.status(200).json(new ApiResponse(200, { count }, "Unread count fetched"));
});

module.exports = { getNotifications, markRead, markAllRead, deleteNotification, unreadCount };
