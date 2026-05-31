const mongoose = require("mongoose");

const GAME_IDS = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];

const communityItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["watch-party", "creator-collab", "team-up"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    host: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    game: {
      type: String,
      enum: GAME_IDS,
      required: true,
      default: "bgmi",
    },
    startsAt: { type: Date, required: true },
    slots: { type: Number, min: 0 },
    maxSlots: { type: Number, min: 0 },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["upcoming", "live", "ended", "cancelled"],
      default: "upcoming",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

communityItemSchema.index({ game: 1, type: 1, startsAt: 1 });
communityItemSchema.index({ isActive: 1, status: 1, startsAt: 1 });
communityItemSchema.index({ creator: 1, createdAt: -1 });

module.exports = mongoose.model("CommunityItem", communityItemSchema);
