const PlayerProfile = require("../models/PlayerProfile.model");
const ScrimEvent = require("../models/ScrimEvent.model");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

const gameIds = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];

// GET /api/v1/leaderboard
const getLeaderboard = asyncHandler(async (req, res) => {
  const {
    game,
    metric = "skillScore",
    period,
    page = 1,
    limit = 25,
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit), 100);
  const filter = {};

  if (game && gameIds.includes(game)) filter.preferredGames = game;

  // Period filter — only show profiles active within the period
  if (period === "week") {
    filter.updatedAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  } else if (period === "month") {
    filter.updatedAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  }

  const sortMap = {
    skillScore: { skillScore: -1, "stats.kd": -1 },
    kd: { "stats.kd": -1, skillScore: -1 },
    wins: { "stats.totalWins": -1, "stats.kd": -1 },
    damage: { "stats.avgDamage": -1, skillScore: -1 },
    views: { profileViews: -1, skillScore: -1 },
  };

  const sort = sortMap[metric] || sortMap.skillScore;

  const players = await PlayerProfile.find(filter)
    .populate("user", "username avatar role followers")
    .select("displayName stats role roles badges skillScore profileViews preferredGames country user")
    .skip((parseInt(page) - 1) * parsedLimit)
    .limit(parsedLimit)
    .sort(sort);

  const total = await PlayerProfile.countDocuments(filter);

  // Compute rank position
  const offset = (parseInt(page) - 1) * parsedLimit;
  const ranked = players.map((player, index) => {
    const json = player.toObject();
    return {
      ...json,
      position: offset + index + 1,
      username: json.user?.username,
      avatar: json.user?.avatar,
      followers: json.user?.followers?.length || 0,
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        entries: ranked,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parsedLimit),
        metric,
        game: game || "all",
      },
      "Leaderboard fetched"
    )
  );
});

// GET /api/v1/leaderboard/scrim-stats — aggregated scrim performance
const getScrimLeaderboard = asyncHandler(async (req, res) => {
  const { game, limit = 20 } = req.query;
  const parsedLimit = Math.min(parseInt(limit), 50);

  const matchStage = { status: "completed" };
  if (game) matchStage.game = game;

  const results = await ScrimEvent.aggregate([
    { $match: matchStage },
    { $unwind: "$registrations" },
    { $unwind: "$registrations.players" },
    {
      $group: {
        _id: "$registrations.players",
        totalScrims: { $sum: 1 },
        totalKills: { $sum: { $ifNull: ["$registrations.performance.kills", 0] } },
        totalDamage: { $sum: { $ifNull: ["$registrations.performance.damage", 0] } },
        avgPlacement: { $avg: { $ifNull: ["$registrations.performance.placement", 0] } },
      },
    },
    { $sort: { totalKills: -1, totalDamage: -1 } },
    { $limit: parsedLimit },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        username: "$user.username",
        avatar: "$user.avatar",
        totalScrims: 1,
        totalKills: 1,
        totalDamage: 1,
        avgPlacement: 1,
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(200, results, "Scrim leaderboard fetched")
  );
});

module.exports = { getLeaderboard, getScrimLeaderboard };
