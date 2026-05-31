const Organization = require("../models/Organization.model");
const PlayerProfile = require("../models/PlayerProfile.model");
const User = require("../models/User.model");
const { uploadToCloudinary } = require("../services/upload.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const Joi = require("joi");

const playerRoles = ["IGL", "Assaulter", "Support", "Scout", "Sniper", "Filter", "Fragger", "All-rounder"];
const gameIds = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];

// Validation
const orgSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  bannerImage: Joi.string().allow("").optional(),
  orgType: Joi.string().valid("Esports Team", "Gaming Company", "Content Studio", "Tournament Organizer", "Sponsor").optional(),
  foundedYear: Joi.number().min(1950).max(new Date().getFullYear()).optional(),
  website: Joi.string().uri().optional().allow(""),
  country: Joi.string().optional(),
  activeGames: Joi.array().items(Joi.string().valid(...gameIds)).optional(),
  openRoles: Joi.array().items(Joi.string().valid(...playerRoles)).optional(),
  socialLinks: Joi.object({
    twitter: Joi.string().allow("").optional(),
    youtube: Joi.string().allow("").optional(),
    instagram: Joi.string().allow("").optional(),
  }).optional(),
  recruitmentRegions: Joi.array().items(Joi.string()).optional(),
  recruitmentCriteria: Joi.object({
    minRank: Joi.string()
      .valid(
        "Bronze","Silver","Gold","Platinum",
        "Diamond","Crown","Ace","Ace Master","Conqueror"
      )
      .optional(),
    roles: Joi.array()
      .items(
        Joi.string().valid(...playerRoles)
      )
      .optional(),
    minKD: Joi.number().min(0).optional(),
  }).optional(),
});

// POST /api/v1/organizations — Create org
const createOrganization = asyncHandler(async (req, res) => {
  const existing = await Organization.findOne({ owner: req.user._id });
  if (existing) {
    throw new ApiError(400, "You already have an organization. Update it instead.");
  }

  const { error, value } = orgSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  let logo = "";
  if (req.file) {
    const result = await uploadToCloudinary(
      req.file.buffer,
      "bgmi/org-logos",
      "image"
    );
    logo = result.secure_url;
  }

  const org = await Organization.create({
    owner: req.user._id,
    ...value,
    logo,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, org, "Organization created"));
});

// PUT /api/v1/organizations — Update org
const updateOrganization = asyncHandler(async (req, res) => {
  const { error, value } = orgSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  let updateData = { ...value };

  if (req.file) {
    const result = await uploadToCloudinary(
      req.file.buffer,
      "bgmi/org-logos",
      "image"
    );
    updateData.logo = result.secure_url;
  }

  const org = await Organization.findOneAndUpdate(
    { owner: req.user._id },
    { $set: updateData },
    { new: true, runValidators: true }
  );
  if (!org) throw new ApiError(404, "Organization not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, org, "Organization updated"));
});

// GET /api/v1/organizations/:orgId — Get org profile
const getOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.orgId).populate(
    "owner",
    "username avatar email"
  );
  if (!org) throw new ApiError(404, "Organization not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, org, "Organization fetched"));
});

// -----------------------------------------------
// 🎯 RECRUITER DASHBOARD
// -----------------------------------------------

// GET /api/v1/organizations/dashboard/players
// Org finds players matching their recruitment criteria
const recruiterDashboard = asyncHandler(async (req, res) => {
  const org = await Organization.findOne({ owner: req.user._id });
  if (!org) throw new ApiError(404, "You don't have an organization yet.");

  const { minRank, roles, minKD } = org.recruitmentCriteria || {};
  const { page = 1, limit = 10 } = req.query;

  const rankOrder = [
    "Bronze","Silver","Gold","Platinum",
    "Diamond","Crown","Ace","Ace Master","Conqueror",
  ];

  const filter = { isOpenToRecruit: true };

  if (minRank) {
    const minIndex = rankOrder.indexOf(minRank);
    const eligibleRanks = rankOrder.slice(minIndex);
    filter["stats.rank"] = { $in: eligibleRanks };
  }

  if (roles?.length) filter.$or = [{ role: { $in: roles } }, { roles: { $in: roles } }];
  if (minKD) filter["stats.kd"] = { $gte: minKD };

  const players = await PlayerProfile.find(filter)
    .populate("user", "username avatar email")
    .select("displayName stats role country bgmiUID isOpenToRecruit")
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ skillScore: -1, profileViews: -1, "stats.kd": -1 });

  const total = await PlayerProfile.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        players,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        appliedCriteria: org.recruitmentCriteria,
      },
      "Recruiter dashboard loaded"
    )
  );
});

// GET /api/v1/organizations/scouting
const scouting = asyncHandler(async (req, res) => {
  const {
    game,
    rank,
    role,
    country,
    availability,
    minSkill,
    page = 1,
    limit = 20,
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit), 50);
  const filter = {};

  if (game) filter.preferredGames = game;
  if (rank) filter["stats.rank"] = rank;
  if (role) filter.$or = [{ role }, { roles: role }];
  if (country) filter.country = country;
  if (availability === "open") {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ isOpenToTeam: true }, { isOpenToRecruit: true }] },
    ];
  }
  if (minSkill) filter.skillScore = { $gte: parseFloat(minSkill) };

  const players = await PlayerProfile.find(filter)
    .populate("user", "username avatar email followers")
    .select("-clips")
    .skip((parseInt(page) - 1) * parsedLimit)
    .limit(parsedLimit)
    .sort({ skillScore: -1, profileViews: -1, "stats.kd": -1 });

  const total = await PlayerProfile.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      { players, total, page: parseInt(page), pages: Math.ceil(total / parsedLimit) },
      "Scouting players fetched"
    )
  );
});

// POST /api/v1/organizations/save-player/:playerId — Bookmark a player
const savePlayer = asyncHandler(async (req, res) => {
  const org = await Organization.findOne({ owner: req.user._id });
  if (!org) throw new ApiError(404, "Organization not found.");

  const targetUser = await User.findById(req.params.playerId);
  if (!targetUser) throw new ApiError(404, "Player not found.");

  const saved = org.savedPlayers.find((item) => item.playerId?.equals(req.params.playerId));
  if (saved) {
    org.savedPlayers.pull(saved._id);
  } else {
    org.savedPlayers.push({ playerId: targetUser._id, notes: req.body.notes || "" });
  }
  await org.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      null,
      saved ? "Player removed from saved list" : "Player saved"
    )
  );
});

// GET /api/v1/organizations/saved-players — View all bookmarked players
const getSavedPlayers = asyncHandler(async (req, res) => {
  const org = await Organization.findOne({ owner: req.user._id }).populate({
    path: "savedPlayers.playerId",
    select: "username avatar email",
  });
  if (!org) throw new ApiError(404, "Organization not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, org.savedPlayers, "Saved players fetched"));
});

// PATCH /api/v1/organizations/:orgId/verify — Admin verifies org
const verifyOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findByIdAndUpdate(
    req.params.orgId,
    { isVerified: true },
    { new: true }
  );
  if (!org) throw new ApiError(404, "Organization not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, org, "Organization verified"));
});

module.exports = {
  createOrganization,
  updateOrganization,
  getOrganization,
  recruiterDashboard,
  savePlayer,
  getSavedPlayers,
  scouting,
  verifyOrganization,
};
