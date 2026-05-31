const mongoose = require("mongoose");

const GAME_IDS = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const POST_TYPES = ["general", "recruitment", "achievement", "scrim_announcement", "clip"];

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorType: {
      type: String,
      enum: ["player", "organization"],
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    game: {
      type: String,
      enum: GAME_IDS,
      default: "bgmi",
    },
    gameTag: {
      type: String,
      enum: GAME_IDS,
      default: "bgmi",
    },
    body: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: { type: String },
    mediaUrls: [{ type: String }],
    postType: {
      type: String,
      enum: POST_TYPES,
      default: "general",
    },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true, maxlength: 300 },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    reposts: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    poll: {
      question: { type: String, maxlength: 200 },
      options: [
        {
          text: { type: String, maxlength: 120 },
          votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        },
      ],
      expiresAt: { type: Date },
    },
    linkedScrim: { type: mongoose.Schema.Types.ObjectId, ref: "ScrimEvent" },
    linkedAchievement: { type: mongoose.Schema.Types.ObjectId, ref: "Achievement" },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

postSchema.index({ game: 1, authorType: 1, createdAt: -1 });
postSchema.index({ gameTag: 1, authorType: 1, postType: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ clubId: 1, createdAt: -1 });

postSchema.pre("validate", function () {
  if (!this.content && this.body) this.content = this.body;
  if (!this.body && this.content) this.body = this.content;
  if (!this.gameTag && this.game) this.gameTag = this.game;
  if (!this.game && this.gameTag) this.game = this.gameTag;
  if (this.image && !this.mediaUrls?.length) this.mediaUrls = [this.image];
  if (this.mediaUrls?.length && !this.image) this.image = this.mediaUrls[0];
  if (this.shares && !this.reposts) this.reposts = this.shares;
  if (this.reposts && !this.shares) this.shares = this.reposts;
});

module.exports = mongoose.model("Post", postSchema);
