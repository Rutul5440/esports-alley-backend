const mongoose = require("mongoose");

const GAME_IDS = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const PLAYER_ROLES = ["IGL", "Assaulter", "Support", "Scout", "Sniper", "Filter", "Fragger", "All-rounder"];
const SCRIM_LEVELS = ["Rookie", "Contender", "Elite", "Master", "Conqueror"];
const RANKS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Crown", "Ace", "Ace Master", "Conqueror"];
const PLAY_STYLES = ["Aggressive", "Passive", "Balanced"];

const playerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    displayName: { type: String, required: true },
    bio: { type: String, maxlength: 300 },
    country: { type: String },
    bannerImage: { type: String, default: "" },
    bgmiUID: { type: String, unique: true, sparse: true },

    // In-game stats
    stats: {
      rank: {
        type: String,
        enum: ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Crown", "Ace", "Ace Master", "Conqueror"],
        default: "Bronze",
      },
      tier: { type: Number, default: 1 }, // e.g., Ace I, Ace II, Ace III
      kd: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 }, // percentage
      avgDamage: { type: Number, default: 0 },
      totalMatches: { type: Number, default: 0 },
      totalWins: { type: Number, default: 0 },
    },

    // Player's in-game role
    role: {
      type: String,
    },
    gameStats: [
      {
        game: { type: String, enum: GAME_IDS, required: true },
        rank: { type: String, default: "Bronze" },
        kd: { type: Number, default: 0, min: 0 },
        winRate: { type: Number, default: 0, min: 0, max: 100 },
        avgDamage: { type: Number, default: 0, min: 0 },
        totalMatches: { type: Number, default: 0, min: 0 },
        totalWins: { type: Number, default: 0, min: 0 },
      },
    ],
    roles: [{ type: String }],
    playStyle: { type: String, enum: PLAY_STYLES },
    languages: [{ type: String, trim: true }],
    preferredGames: {
      type: [{ type: String, enum: GAME_IDS }],
      default: ["bgmi"],
    },
    badges: [{ type: String, enum: SCRIM_LEVELS }],
    scrimBadges: [
      {
        scrimId: { type: mongoose.Schema.Types.ObjectId, ref: "ScrimEvent" },
        tier: { type: Number, min: 1, max: 5 },
        tierName: { type: String },
        earnedAt: { type: Date, default: Date.now },
      },
    ],
    skillScore: { type: Number, default: 0, min: 0, max: 100 },
    profileViews: { type: Number, default: 0, min: 0 },
    isOpenToTeam: { type: Boolean, default: true },
    openToTeam: { type: Boolean, default: true },

    // Preferred game mode
    preferredMode: {
      type: String,
      enum: ["Squad", "Duo", "Solo"],
      default: "Squad",
    },

    // Social links
    socialLinks: {
      youtube: { type: String },
      instagram: { type: String },
      twitch: { type: String },
      discord: { type: String },
    },

    isOpenToRecruit: { type: Boolean, default: true },

    achievements: [{ type: mongoose.Schema.Types.ObjectId, ref: "Achievement" }],
    clips: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clip" }],
  },
  { timestamps: true }
);

// Index for search performance
playerProfileSchema.index({ "stats.rank": 1, role: 1, roles: 1, country: 1 });
playerProfileSchema.index({ preferredGames: 1, isOpenToTeam: 1, skillScore: -1, profileViews: -1 });

module.exports = mongoose.model("PlayerProfile", playerProfileSchema);
