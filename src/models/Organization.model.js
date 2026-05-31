const mongoose = require("mongoose");

const GAME_IDS = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const PLAYER_ROLES = ["IGL", "Assaulter", "Support", "Scout", "Sniper", "Filter", "Fragger", "All-rounder"];
const ORG_TYPES = ["Esports Team", "Gaming Company", "Content Studio", "Tournament Organizer", "Sponsor"];

const organizationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, maxlength: 500 },
    logo: { type: String },
    bannerImage: { type: String, default: "" },
    website: { type: String },
    country: { type: String },
    orgType: {
      type: String,
      enum: ORG_TYPES,
      default: "Esports Team",
    },
    foundedYear: {
      type: Number,
      min: 1950,
      max: new Date().getFullYear(),
    },
    isVerified: { type: Boolean, default: false },
    activeGames: {
      type: [{ type: String, enum: GAME_IDS }],
      default: ["bgmi"],
    },
    openRoles: [{ type: String, enum: PLAYER_ROLES }],
    followersCount: { type: Number, default: 0, min: 0 },
    profileViews: { type: Number, default: 0, min: 0 },

    // Players this org is looking for
    recruitmentCriteria: {
      minRank: {
        type: String,
        enum: ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Crown", "Ace", "Ace Master", "Conqueror"],
      },
      roles: [{ type: String, enum: PLAYER_ROLES }],
      minKD: { type: Number },
    },

    roster: [
      {
        player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, trim: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    socialLinks: {
      twitter: { type: String },
      youtube: { type: String },
      instagram: { type: String },
    },
    recruitmentRegions: [{ type: String, trim: true }],
    analytics: {
      totalScrims: { type: Number, default: 0, min: 0 },
      totalRecruits: { type: Number, default: 0, min: 0 },
      profileViews: { type: Number, default: 0, min: 0 },
    },

    savedPlayers: [
      {
        playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        notes: { type: String, maxlength: 1000, default: "" },
        savedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
