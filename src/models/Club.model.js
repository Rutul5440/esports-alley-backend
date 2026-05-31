const mongoose = require("mongoose");

const GAME_IDS = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const EVENT_TYPES = ["watch_party", "collab", "team_up", "general"];

const clubEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: EVENT_TYPES, default: "general" },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, maxlength: 800, default: "" },
    game: { type: String, enum: GAME_IDS, default: "bgmi" },
    scheduledAt: { type: Date, required: true },
    link: { type: String, default: "" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    maxAttendees: { type: Number, min: 0 },
    requirements: {
      minFollowers: { type: Number, min: 0 },
      rank: { type: String },
      role: { type: String },
    },
  },
  { timestamps: true }
);

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 800, default: "" },
    banner: { type: String, default: "" },
    gameTag: { type: String, enum: GAME_IDS, default: "bgmi" },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPrivate: { type: Boolean, default: false },
    rules: { type: String, maxlength: 2000, default: "" },
    events: [clubEventSchema],
    memberCount: { type: Number, default: 1, min: 0 },
    tags: [{ type: String, trim: true, maxlength: 40 }],
  },
  { timestamps: true }
);

clubSchema.index({ gameTag: 1, isPrivate: 1, memberCount: -1 });
clubSchema.index({ creator: 1, createdAt: -1 });

clubSchema.pre("save", function () {
  this.memberCount = this.members?.length || 0;
});

module.exports = mongoose.model("Club", clubSchema);
