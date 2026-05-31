const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const GAME_IDS = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const RANKS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Crown", "Ace", "Ace Master", "Conqueror"];
const PLAY_STYLES = ["Aggressive", "Passive", "Balanced"];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ["player", "organization", "admin"],
      default: "player",
    },
    avatar: {
      type: String,
      default: "",
    },
    bannerImage: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gamePreferences: [
      {
        game: { type: String, enum: GAME_IDS },
        rank: { type: String, enum: RANKS },
        kd: { type: Number, default: 0, min: 0 },
        winRate: { type: Number, default: 0, min: 0, max: 100 },
        avgDamage: { type: Number, default: 0, min: 0 },
        totalMatches: { type: Number, default: 0, min: 0 },
      },
    ],
    playStyle: {
      type: String,
      enum: PLAY_STYLES,
    },
    languages: [{ type: String, trim: true }],
    openToTeam: {
      type: Boolean,
      default: false,
    },
    savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    clubs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Club" }],
    notifications: [{ type: mongoose.Schema.Types.ObjectId, ref: "Notification" }],
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
