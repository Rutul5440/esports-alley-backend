const PlayerProfile = require("../models/PlayerProfile.model");
const User = require("../models/User.model");
const Organization = require("../models/Organization.model");
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

// GET /api/v1/profile/:userId — Get any player's profile by id or username
const getProfile = asyncHandler(async (req, res) => {
  const identifier = req.params.userId;
  const user = identifier.match(/^[0-9a-fA-F]{24}$/)
    ? await User.findById(identifier)
    : await User.findOne({ username: identifier.toLowerCase() });
  if (!user) throw new ApiError(404, "User not found.");

  if (user.role === "organization") {
    const org = await Organization.findOne({ owner: user._id }).populate("owner", "username avatar email followers following");
    if (!org) throw new ApiError(404, "Organization profile not found.");
    return res.status(200).json(new ApiResponse(200, { type: "organization", user, organization: org }, "Organization profile fetched"));
  }

  const profile = await PlayerProfile.findOne({ user: user._id })
    .populate("user", "username avatar bio followers following")
    .populate("achievements")
    .populate("clips", "title thumbnailUrl views likes game");

  if (!profile) throw new ApiError(404, "Profile not found.");
  return res.status(200).json(new ApiResponse(200, profile, "Profile fetched"));
});

// POST /api/v1/profile/:userId/view — Track profile view
const trackProfileView = asyncHandler(async (req, res) => {
  // Don't count self-views
  if (req.user && req.user._id.toString() === req.params.userId) {
    return res.status(200).json(new ApiResponse(200, null, "Self-view not counted"));
  }

  await PlayerProfile.findOneAndUpdate(
    { user: req.params.userId },
    { $inc: { profileViews: 1 } }
  );
  return res.status(200).json(new ApiResponse(200, null, "View tracked"));
});

// GET /api/v1/profile/top — Featured players for landing page
const getTopPlayers = asyncHandler(async (req, res) => {
  const { game, limit = 6 } = req.query;
  const parsedLimit = Math.min(parseInt(limit), 20);
  const filter = {};

  if (game) filter.preferredGames = game;

  const players = await PlayerProfile.find(filter)
    .populate("user", "username avatar role followers")
    .select("displayName stats role roles badges skillScore profileViews preferredGames country isOpenToTeam user")
    .sort({ skillScore: -1, profileViews: -1 })
    .limit(parsedLimit);

  return res.status(200).json(new ApiResponse(200, players, "Top players fetched"));
});

// GET /api/v1/profile/search — Search players
const searchPlayers = asyncHandler(async (req, res) => {
  const { rank, role, game, minKD, maxKD, minSkill, country, availability, page = 1, limit = 10 } = req.query;

  const filter = {};
  if (rank) filter["stats.rank"] = rank;
  if (role) filter.$or = [{ role }, { roles: role }];
  if (game) filter.preferredGames = game;
  if (country) filter.country = country;
  if (availability === "open") {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ isOpenToTeam: true }, { isOpenToRecruit: true }] },
    ];
  }
  if (minSkill) filter.skillScore = { $gte: parseFloat(minSkill) };
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
    .sort({ skillScore: -1, profileViews: -1, "stats.kd": -1 });

  const total = await PlayerProfile.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, { players, total, page: parseInt(page), pages: Math.ceil(total / limit) }, "Players fetched")
  );
});

module.exports = { createProfile, updateProfile, getProfile, trackProfileView, getTopPlayers, searchPlayers };
