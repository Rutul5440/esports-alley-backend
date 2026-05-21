const mongoose = require("mongoose");

const clipSchema = new mongoose.Schema(
  {
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    videoUrl: { type: String, required: true },   // Cloudinary URL
    thumbnailUrl: { type: String },
    duration: { type: Number },                    // seconds
    tags: [{ type: String }],                      // e.g., ["clutch", "snipe", "BGMI"]
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true, maxlength: 300 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    views: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Clip", clipSchema);