const mongoose = require("mongoose");

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
    website: { type: String },
    country: { type: String },
    isVerified: { type: Boolean, default: false },

    // Players this org is looking for
    recruitmentCriteria: {
      minRank: {
        type: String,
        enum: ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Crown", "Ace", "Ace Master", "Conqueror"],
      },
      roles: [{ type: String, enum: ["IGL", "Fragger", "Support", "Scout", "Sniper", "All-rounder"] }],
      minKD: { type: Number },
    },

    savedPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);