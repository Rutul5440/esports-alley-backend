const PlayerProfile = require("../models/PlayerProfile.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// POST /api/v1/profile — Create profile
const createProfile = asyncHandler(async (req, res) => {
  const exists = await PlayerProfile.findOne({ user: req.user._id });
  if (exists) throw new ApiError(400, "Profile already exists. Use update instead.");

  const profile = await PlayerProfile.create({ user: req.user._id, ...req.body });
  return res.status(201).json(new ApiResponse(201, profile, "Profile created"));
});

// PUT /api/v1/profile — Update profile
const updateProfile = asyncHandler(async (req, res) => {
  const profile = await PlayerProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!profile) throw new ApiError(404, "Profile not found.");
  return res.status(200).json(new ApiResponse(200, profile, "Profile updated"));
});

// GET /api/v1/profile/:userId — Get any player's profile
const getProfile = asyncHandler(async (req, res) => {
  const profile = await PlayerProfile.findOne({ user: req.params.userId })
    .populate("user", "username avatar")
    .populate("achievements")
    .populate("clips", "title thumbnailUrl views likes");

  if (!profile) throw new ApiError(404, "Profile not found.");
  return res.status(200).json(new ApiResponse(200, profile, "Profile fetched"));
});

// GET /api/v1/profile/search — Search players
const searchPlayers = asyncHandler(async (req, res) => {
  const { rank, role, minKD, maxKD, country, page = 1, limit = 10 } = req.query;

  const filter = {};
  if (rank) filter["stats.rank"] = rank;
  if (role) filter.role = role;
  if (country) filter.country = country;
  if (minKD || maxKD) {
    filter["stats.kd"] = {};
    if (minKD) filter["stats.kd"].$gte = parseFloat(minKD);
    if (maxKD) filter["stats.kd"].$lte = parseFloat(maxKD);
  }

  const players = await PlayerProfile.find(filter)
    .populate("user", "username avatar")
    .select("-clips -achievements")
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ "stats.kd": -1 });

  const total = await PlayerProfile.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, { players, total, page: parseInt(page), pages: Math.ceil(total / limit) }, "Players fetched")
  );
});

module.exports = { createProfile, updateProfile, getProfile, searchPlayers };