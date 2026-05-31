const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 300 },
    badge: {
      type: String,
      enum: ["Tournament Winner", "Top Fragger", "Conqueror Badge", "MVP", "Custom"],
      default: "Custom",
    },
    proofImage: { type: String },
    earnedAt: { type: Date, default: Date.now },
    verifiedByOrg: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Achievement", achievementSchema);
