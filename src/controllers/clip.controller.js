const Clip = require("../models/Clip.model");
const PlayerProfile = require("../models/PlayerProfile.model");
const { uploadToCloudinary } = require("../services/upload.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const gameIds = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];

// GET /api/v1/clips — list all clips (paginated)
const getAllClips = asyncHandler(async (req, res) => {
  const { game, sort = "recent", page = 1, limit = 20 } = req.query;
  const parsedLimit = Math.min(parseInt(limit), 50);
  const filter = { isPublic: true };

  if (game && gameIds.includes(game)) filter.game = game;

  const sortMap = {
    recent: { createdAt: -1 },
    popular: { views: -1, createdAt: -1 },
    liked: { likesCount: -1, createdAt: -1 },
  };

  const clips = await Clip.find(filter)
    .populate("uploader", "username avatar")
    .select("-comments")
    .skip((parseInt(page) - 1) * parsedLimit)
    .limit(parsedLimit)
    .sort(sortMap[sort] || sortMap.recent);

  const total = await Clip.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, { clips, total, page: parseInt(page), pages: Math.ceil(total / parsedLimit) }, "Clips fetched")
  );
});

// GET /api/v1/clips/user/:userId — get clips by user
const getUserClips = asyncHandler(async (req, res) => {
  const clips = await Clip.find({ uploader: req.params.userId, isPublic: true })
    .populate("uploader", "username avatar")
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, clips, "User clips fetched"));
});

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
    game: req.body.game || "bgmi",
    tags: req.body.tags ? (typeof req.body.tags === "string" ? req.body.tags.split(",").map((t) => t.trim()) : req.body.tags) : [],
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

// PUT /api/v1/clips/:clipId — update title, description, tags
const updateClip = asyncHandler(async (req, res) => {
  const clip = await Clip.findById(req.params.clipId);
  if (!clip) throw new ApiError(404, "Clip not found.");
  if (!clip.uploader.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You can only edit your own clips.");
  }

  const { title, description, tags, game } = req.body;
  if (title) clip.title = title;
  if (description !== undefined) clip.description = description;
  if (tags) clip.tags = typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags;
  if (game && gameIds.includes(game)) clip.game = game;

  await clip.save();
  return res.status(200).json(new ApiResponse(200, clip, "Clip updated"));
});

// DELETE /api/v1/clips/:clipId
const deleteClip = asyncHandler(async (req, res) => {
  const clip = await Clip.findById(req.params.clipId);
  if (!clip) throw new ApiError(404, "Clip not found.");
  if (!clip.uploader.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You can only delete your own clips.");
  }

  // Remove from player profile
  await PlayerProfile.findOneAndUpdate(
    { user: clip.uploader },
    { $pull: { clips: clip._id } }
  );

  await clip.deleteOne();
  return res.status(200).json(new ApiResponse(200, null, "Clip deleted"));
});

// POST /api/v1/clips/:clipId/like
const toggleLike = asyncHandler(async (req, res) => {
  const clip = await Clip.findById(req.params.clipId);
  if (!clip) throw new ApiError(404, "Clip not found.");

  const alreadyLiked = clip.likes.some((id) => id.equals(req.user._id));
  const update = alreadyLiked
    ? { $pull: { likes: req.user._id } }
    : { $addToSet: { likes: req.user._id } };

  await clip.updateOne(update);

  // Create Like Notification (only on new likes, and only if liking someone else's clip)
  if (!alreadyLiked && !clip.uploader.equals(req.user._id)) {
    const Notification = require("../models/Notification.model");
    await Notification.create({
      recipient: clip.uploader,
      sender: req.user._id,
      type: "like",
      message: `@${req.user.username} liked your clip: "${clip.title}"`,
      link: "/clips",
    });
  }

  return res.status(200).json(
    new ApiResponse(200, { liked: !alreadyLiked }, alreadyLiked ? "Unliked" : "Liked")
  );
});

// POST /api/v1/clips/:clipId/comment
const addComment = asyncHandler(async (req, res) => {
  const clip = await Clip.findById(req.params.clipId);
  if (!clip) throw new ApiError(404, "Clip not found.");
  if (!req.body.text) throw new ApiError(400, "Comment text is required.");

  clip.comments.push({ user: req.user._id, text: req.body.text });
  await clip.save();

  // Create Comment Notification (only if commenting on someone else's clip)
  if (!clip.uploader.equals(req.user._id)) {
    const Notification = require("../models/Notification.model");
    const previewText = req.body.text.length > 30 ? `${req.body.text.slice(0, 30)}...` : req.body.text;
    await Notification.create({
      recipient: clip.uploader,
      sender: req.user._id,
      type: "comment",
      message: `@${req.user.username} commented on your clip: "${previewText}"`,
      link: "/clips",
    });
  }

  const populated = await Clip.findById(clip._id).populate("comments.user", "username avatar");
  return res.status(201).json(new ApiResponse(201, populated.comments, "Comment added"));
});

// DELETE /api/v1/clips/:clipId/comment/:commentId
const deleteComment = asyncHandler(async (req, res) => {
  const clip = await Clip.findById(req.params.clipId);
  if (!clip) throw new ApiError(404, "Clip not found.");

  const comment = clip.comments.id(req.params.commentId);
  if (!comment) throw new ApiError(404, "Comment not found.");
  if (!comment.user.equals(req.user._id) && !clip.uploader.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot delete this comment.");
  }

  comment.deleteOne();
  await clip.save();
  return res.status(200).json(new ApiResponse(200, clip.comments, "Comment deleted"));
});

module.exports = { getAllClips, getUserClips, uploadClip, getClip, updateClip, deleteClip, toggleLike, addComment, deleteComment };
