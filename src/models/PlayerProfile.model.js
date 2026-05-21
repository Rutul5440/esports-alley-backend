const mongoose = require("mongoose");

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
      enum: ["IGL", "Fragger", "Support", "Scout", "Sniper", "All-rounder"],
    },

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
playerProfileSchema.index({ "stats.rank": 1, role: 1, country: 1 });

module.exports = mongoose.model("PlayerProfile", playerProfileSchema);