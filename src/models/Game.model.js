const mongoose = require("mongoose");

const GAME_IDS = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const RANKS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Crown", "Ace", "Ace Master", "Conqueror"];

const gameSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    shortName: { type: String, required: true, trim: true, maxlength: 20 },
    icon: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    rankSystem: [{ type: String }],
    roles: [{ type: String }],
    isActive: { type: Boolean, default: true },
    playerCount: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

gameSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model("Game", gameSchema);
