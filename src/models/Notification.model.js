const mongoose = require("mongoose");

const TYPES = [
  "follow",
  "like",
  "comment",
  "scrim_invite",
  "recruitment",
  "club_invite",
  "achievement",
  "scrim_result",
  "mention",
];

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { type: String, enum: TYPES, required: true },
  message: { type: String, required: true, maxlength: 300 },
  link: { type: String, default: "" },
  isRead: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
