const Game = require("../models/Game.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const DEFAULT_GAMES = [
  { id: "bgmi", name: "Battlegrounds Mobile India", shortName: "BGMI", rankSystem: ["Bronze","Silver","Gold","Platinum","Diamond","Crown","Ace","Ace Master","Conqueror"], roles: ["IGL","Assaulter","Support","Scout","Sniper","Filter","Fragger","All-rounder"], order: 1 },
  { id: "valorant", name: "Valorant", shortName: "VALO", rankSystem: ["Iron","Bronze","Silver","Gold","Platinum","Diamond","Ascendant","Immortal","Radiant"], roles: ["Duelist","Controller","Initiator","Sentinel"], order: 2 },
  { id: "cs2", name: "Counter-Strike 2", shortName: "CS2", rankSystem: ["Silver","Gold Nova","Master Guardian","Legendary Eagle","Supreme","Global Elite"], roles: ["Entry","AWPer","Lurker","Support","IGL"], order: 3 },
  { id: "free-fire", name: "Free Fire", shortName: "FF", rankSystem: ["Bronze","Silver","Gold","Platinum","Diamond","Heroic","Grandmaster"], roles: ["Rusher","Supporter","Sniper","IGL"], order: 4 },
  { id: "apex-legends", name: "Apex Legends Mobile", shortName: "APEX", rankSystem: ["Bronze","Silver","Gold","Platinum","Diamond","Master","Predator"], roles: ["Assault","Skirmisher","Recon","Controller","Support"], order: 5 },
  { id: "pubg-ns", name: "PUBG: New State", shortName: "PUBG:NS", rankSystem: ["Bronze","Silver","Gold","Platinum","Diamond","Crown","Ace","Conqueror"], roles: ["IGL","Assaulter","Support","Scout","Sniper"], order: 6 },
];

// GET /api/v1/games — list all games (public)
const listGames = asyncHandler(async (req, res) => {
  let games = await Game.find({ isActive: true }).sort({ order: 1 });

  // Auto-seed if empty
  if (!games.length) {
    await Game.insertMany(DEFAULT_GAMES);
    games = await Game.find({ isActive: true }).sort({ order: 1 });
  }

  return res.status(200).json(new ApiResponse(200, games, "Games fetched"));
});

// GET /api/v1/games/:gameId — get single game
const getGame = asyncHandler(async (req, res) => {
  const game = await Game.findOne({ id: req.params.gameId });
  if (!game) throw new ApiError(404, "Game not found.");
  return res.status(200).json(new ApiResponse(200, game, "Game fetched"));
});

// POST /api/v1/games — add new game (admin only)
const addGame = asyncHandler(async (req, res) => {
  const { id, name, shortName, icon, coverImage, rankSystem, roles, order } = req.body;
  if (!id || !name || !shortName) throw new ApiError(400, "id, name, and shortName are required.");

  const existing = await Game.findOne({ id });
  if (existing) throw new ApiError(409, "Game with this ID already exists.");

  const game = await Game.create({ id, name, shortName, icon, coverImage, rankSystem, roles, order });
  return res.status(201).json(new ApiResponse(201, game, "Game added"));
});

// PUT /api/v1/games/:gameId — update game (admin only)
const updateGame = asyncHandler(async (req, res) => {
  const game = await Game.findOneAndUpdate(
    { id: req.params.gameId },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!game) throw new ApiError(404, "Game not found.");
  return res.status(200).json(new ApiResponse(200, game, "Game updated"));
});

module.exports = { listGames, getGame, addGame, updateGame };
