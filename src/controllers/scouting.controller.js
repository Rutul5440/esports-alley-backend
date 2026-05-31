const Organization = require("../models/Organization.model");
const PlayerProfile = require("../models/PlayerProfile.model");
const User = require("../models/User.model");
const Notification = require("../models/Notification.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const getOrg = async (userId) => {
  const org = await Organization.findOne({ owner: userId });
  if (!org) throw new ApiError(404, "Create an organization profile before scouting.");
  return org;
};

const searchPlayers = asyncHandler(async (req, res) => {
  const {
    game,
    rank,
    role,
    country,
    minKD,
    minWinRate,
    openOnly,
    hasClips,
    sort = "skillScore",
    page = 1,
    limit = 20,
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit), 50);
  const filter = {};
  if (game) filter.preferredGames = game;
  if (rank) filter["stats.rank"] = rank;
  if (role) filter.$or = [{ role }, { roles: role }];
  if (country) filter.country = country;
  if (minKD) filter["stats.kd"] = { $gte: parseFloat(minKD) };
  if (minWinRate) filter["stats.winRate"] = { $gte: parseFloat(minWinRate) };
  if (openOnly === "true") filter.$and = [{ $or: [{ isOpenToTeam: true }, { isOpenToRecruit: true }, { openToTeam: true }] }];
  if (hasClips === "true") filter.clips = { $exists: true, $ne: [] };

  const sortMap = {
    kd: { "stats.kd": -1 },
    winRate: { "stats.winRate": -1 },
    followers: { "user.followers": -1 },
    recentlyActive: { updatedAt: -1 },
    views: { profileViews: -1 },
    skillScore: { skillScore: -1, profileViews: -1 },
  };

  const players = await PlayerProfile.find(filter)
    .populate("user", "username avatar email followers")
    .select("-achievements")
    .skip((parseInt(page) - 1) * parsedLimit)
    .limit(parsedLimit)
    .sort(sortMap[sort] || sortMap.skillScore);

  const total = await PlayerProfile.countDocuments(filter);
  return res.status(200).json(new ApiResponse(200, { players, total, page: parseInt(page), pages: Math.ceil(total / parsedLimit) }, "Scouting players fetched"));
});

const toggleSavePlayer = asyncHandler(async (req, res) => {
  const org = await getOrg(req.user._id);
  const player = await User.findById(req.params.playerId);
  if (!player || player.role !== "player") throw new ApiError(404, "Player not found.");

  const existing = org.savedPlayers.find((item) => item.playerId?.equals(req.params.playerId));
  if (existing) {
    org.savedPlayers.pull(existing._id);
  } else {
    org.savedPlayers.push({ playerId: player._id, notes: req.body.notes || "" });
  }
  await org.save();
  return res.status(200).json(new ApiResponse(200, { saved: !existing }, existing ? "Player unsaved" : "Player saved"));
});

const getSavedPlayers = asyncHandler(async (req, res) => {
  const org = await Organization.findOne({ owner: req.user._id }).populate({
    path: "savedPlayers.playerId",
    select: "username avatar email followers",
  });
  if (!org) throw new ApiError(404, "Create an organization profile before scouting.");
  return res.status(200).json(new ApiResponse(200, org.savedPlayers, "Saved players fetched"));
});

const upsertNote = asyncHandler(async (req, res) => {
  const org = await getOrg(req.user._id);
  const existing = org.savedPlayers.find((item) => item.playerId?.equals(req.params.playerId));
  if (existing) {
    existing.notes = req.body.notes || "";
  } else {
    org.savedPlayers.push({ playerId: req.params.playerId, notes: req.body.notes || "" });
  }
  await org.save();
  return res.status(200).json(new ApiResponse(200, org.savedPlayers, "Player note saved"));
});

const invitePlayer = asyncHandler(async (req, res) => {
  const org = await getOrg(req.user._id);
  const player = await User.findById(req.params.playerId);
  if (!player || player.role !== "player") throw new ApiError(404, "Player not found.");

  const notification = await Notification.create({
    recipient: player._id,
    sender: req.user._id,
    type: req.body.type || "scrim_invite",
    message: req.body.message || `${org.name} invited you to connect.`,
    link: req.body.link || "/scrims",
  });
  return res.status(201).json(new ApiResponse(201, notification, "Invite sent"));
});

module.exports = { searchPlayers, toggleSavePlayer, getSavedPlayers, upsertNote, invitePlayer };
