const mongoose = require("mongoose");

const GAME_IDS = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const SCRIM_LEVELS = ["Rookie", "Contender", "Elite", "Master", "Conqueror"];
const SCRIM_LEVEL_NAMES = ["Rookie Grounds", "Contender Arena", "Elite Circuit", "Master League", "Conqueror Invitational"];

const scrimEventSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["scrim", "tournament"],
      required: true,
      default: "scrim",
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    game: {
      type: String,
      enum: GAME_IDS,
      required: true,
      default: "bgmi",
    },
    format: {
      type: String,
      enum: ["Solo", "Duo", "Squad"],
      default: "Squad",
    },
    level: {
      type: String,
      enum: SCRIM_LEVELS,
      required: true,
      default: "Rookie",
    },
    levelDetails: {
      tier: { type: Number, min: 1, max: 5, default: 1 },
      name: { type: String, enum: SCRIM_LEVEL_NAMES, default: "Rookie Grounds" },
    },
    startsAt: { type: Date, required: true },
    scheduledAt: { type: Date },
    registrationDeadline: { type: Date },
    prize: { type: String, maxlength: 120 },
    xpReward: { type: Number, default: 0, min: 0 },
    capacity: { type: Number, required: true, min: 2, default: 16 },
    maxTeams: { type: Number, min: 2 },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["draft", "open", "ongoing", "completed", "Open", "Filling Fast", "Invite Only", "Closed"],
      default: "Open",
    },
    rules: { type: String, maxlength: 5000 },
    invitedTeams: [{ type: String, trim: true, maxlength: 80 }],
    isInviteOnly: { type: Boolean, default: false },
    registrations: [
      {
        teamName: { type: String, trim: true, maxlength: 120 },
        players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        registeredAt: { type: Date, default: Date.now },
        status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
        performance: {
          kills: { type: Number, default: 0, min: 0 },
          placement: { type: Number, default: 0, min: 0 },
          damage: { type: Number, default: 0, min: 0 },
        },
      },
    ],
    results: [
      {
        placement: { type: Number, min: 1 },
        teamName: { type: String, trim: true },
        players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        stats: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    analytics: {
      averageDamage: { type: Number, default: 0 },
      averagePlacement: { type: Number, default: 0 },
      retentionPct: { type: Number, default: 0 },
      totalRegistrations: { type: Number, default: 0 },
      avgRankTier: { type: String, default: "" },
      avgKD: { type: Number, default: 0 },
      avgDamage: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      slotFillRate: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

scrimEventSchema.index({ game: 1, kind: 1, level: 1, startsAt: 1 });
scrimEventSchema.index({ organizer: 1, startsAt: -1 });

scrimEventSchema.pre("validate", function () {
  if (!this.scheduledAt && this.startsAt) this.scheduledAt = this.startsAt;
  if (!this.startsAt && this.scheduledAt) this.startsAt = this.scheduledAt;
  if (!this.maxTeams && this.capacity) this.maxTeams = this.capacity;
  if (!this.capacity && this.maxTeams) this.capacity = this.maxTeams;
  const tierByLevel = { Rookie: 1, Contender: 2, Elite: 3, Master: 4, Conqueror: 5 };
  const nameByTier = {
    1: "Rookie Grounds",
    2: "Contender Arena",
    3: "Elite Circuit",
    4: "Master League",
    5: "Conqueror Invitational",
  };
  const tier = this.levelDetails?.tier || tierByLevel[this.level] || 1;
  this.levelDetails = {
    tier,
    name: this.levelDetails?.name || nameByTier[tier],
  };
});

module.exports = mongoose.model("ScrimEvent", scrimEventSchema);
