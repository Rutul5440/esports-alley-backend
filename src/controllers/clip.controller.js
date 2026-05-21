const Clip = require("../models/Clip.model");
const PlayerProfile = require("../models/PlayerProfile.model");
const { uploadToCloudinary } = require("../services/upload.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// POST /api/v1/clips
const uploadClip = asyncHandler(async (req, res) => {
  if (!req.files?.clip?.[0]) throw new ApiError(400, "Clip file is required.");

  const clipResult = await uploadToCloudinary(req.files.clip[0].buffer, "bgmi/clips", "video");

  let thumbnailUrl = "";
  if (req.files?.thumbnail?.[0]) {
    const thumbResult = await uploadToCloudinary(req.files.thumbnail[0].buffer, "bgmi/thumbnails", "image");
    thumbnailUrl = thumbResult.secure_url;
  }

  const clip = await Clip.create({
    uploader: req.user._id,
    title: req.body.title,
    description: req.body.description,
    tags: req.body.tags?.split(",") || [],
    videoUrl: clipResult.secure_url,
    thumbnailUrl,
    duration: clipResult.duration,
  });

  // Add clip reference to player profile
  await PlayerProfile.findOneAndUpdate(
    { user: req.user._id },
    { $push: { clips: clip._id } }
  );

  return res.status(201).json(new ApiResponse(201, clip, "Clip uploaded successfully"));
});

// POST /api/v1/clips/:clipId/like
const toggleLike = asyncHandler(async (req, res) => {
  const clip = await Clip.findById(req.params.clipId);
  if (!clip) throw new ApiError(404, "Clip not found.");

  const alreadyLiked = clip.likes.includes(req.user._id);
  const update = alreadyLiked
    ? { $pull: { likes: req.user._id } }
    : { $push: { likes: req.user._id } };

  await clip.updateOne(update);

  return res.status(200).json(
    new ApiResponse(200, null, alreadyLiked ? "Unliked" : "Liked")
  );
});

// POST /api/v1/clips/:clipId/comment
const addComment = asyncHandler(async (req, res) => {
  const clip = await Clip.findById(req.params.clipId);
  if (!clip) throw new ApiError(404, "Clip not found.");
  if (!req.body.text) throw new ApiError(400, "Comment text is required.");

  clip.comments.push({ user: req.user._id, text: req.body.text });
  await clip.save();

  return res.status(201).json(new ApiResponse(201, clip.comments, "Comment added"));
});

// GET /api/v1/clips/:clipId
const getClip = asyncHandler(async (req, res) => {
  const clip = await Clip.findByIdAndUpdate(
    req.params.clipId,
    { $inc: { views: 1 } },
    { new: true }
  ).populate("uploader", "username avatar")
   .populate("comments.user", "username avatar");

  if (!clip) throw new ApiError(404, "Clip not found.");
  return res.status(200).json(new ApiResponse(200, clip, "Clip fetched"));
});

module.exports = { uploadClip, toggleLike, addComment, getClip };