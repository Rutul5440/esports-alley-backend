const Joi = require("joi");
const CommunityItem = require("../models/CommunityItem.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const gameIds = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const itemTypes = ["watch-party", "creator-collab", "team-up"];

const communitySchema = Joi.object({
  type: Joi.string().valid(...itemTypes).required(),
  title: Joi.string().min(3).max(120).required(),
  host: Joi.string().min(2).max(120).required(),
  game: Joi.string().valid(...gameIds).default("bgmi"),
  startsAt: Joi.date().required(),
  slots: Joi.number().min(0).optional(),
  maxSlots: Joi.number().min(0).optional(),
  description: Joi.string().min(3).max(500).required(),
});

// GET /api/v1/community
const getCommunityItems = asyncHandler(async (req, res) => {
  const { game, type, status, includeInactive = "false", page = 1, limit = 20 } = req.query;
  const parsedLimit = Math.min(parseInt(limit), 50);
  const filter = {};

  if (game) filter.game = game;
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (includeInactive !== "true") filter.isActive = true;

  const items = await CommunityItem.find(filter)
    .populate("creator", "username avatar role")
    .skip((parseInt(page) - 1) * parsedLimit)
    .limit(parsedLimit)
    .sort({ startsAt: 1 });

  const total = await CommunityItem.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, { items, total, page: parseInt(page), pages: Math.ceil(total / parsedLimit) }, "Community items fetched")
  );
});

// GET /api/v1/community/:id
const getCommunityItem = asyncHandler(async (req, res) => {
  const item = await CommunityItem.findById(req.params.id)
    .populate("creator", "username avatar role")
    .populate("participants", "username avatar");

  if (!item) throw new ApiError(404, "Community item not found.");
  return res.status(200).json(new ApiResponse(200, item, "Community item fetched"));
});

// POST /api/v1/community
const createCommunityItem = asyncHandler(async (req, res) => {
  const { error, value } = communitySchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const item = await CommunityItem.create({
    ...value,
    maxSlots: value.maxSlots || value.slots,
    creator: req.user._id,
    participants: [req.user._id],
  });

  return res.status(201).json(new ApiResponse(201, item, "Community item created"));
});

// PUT /api/v1/community/:id
const updateCommunityItem = asyncHandler(async (req, res) => {
  const item = await CommunityItem.findById(req.params.id);
  if (!item) throw new ApiError(404, "Community item not found.");
  if (!item.creator.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You can only edit your own community items.");
  }

  const updateSchema = communitySchema.fork(["type", "title", "host", "startsAt", "description"], (s) => s.optional());
  const { error, value } = updateSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  Object.assign(item, value);
  if (value.maxSlots) item.maxSlots = value.maxSlots;
  await item.save();

  return res.status(200).json(new ApiResponse(200, item, "Community item updated"));
});

// DELETE /api/v1/community/:id
const deleteCommunityItem = asyncHandler(async (req, res) => {
  const item = await CommunityItem.findById(req.params.id);
  if (!item) throw new ApiError(404, "Community item not found.");
  if (!item.creator.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You can only delete your own community items.");
  }

  await item.deleteOne();
  return res.status(200).json(new ApiResponse(200, null, "Community item deleted"));
});

// POST /api/v1/community/:id/join
const joinCommunityItem = asyncHandler(async (req, res) => {
  const item = await CommunityItem.findById(req.params.id);
  if (!item) throw new ApiError(404, "Community item not found.");
  if (!item.isActive) throw new ApiError(400, "This community item is no longer active.");

  if (item.participants.some((id) => id.equals(req.user._id))) {
    throw new ApiError(400, "You have already joined this item.");
  }

  if (item.maxSlots && item.participants.length >= item.maxSlots) {
    throw new ApiError(400, "This item is full.");
  }

  item.participants.addToSet(req.user._id);
  await item.save();

  return res.status(200).json(new ApiResponse(200, item, "Joined successfully"));
});

// POST /api/v1/community/:id/leave
const leaveCommunityItem = asyncHandler(async (req, res) => {
  const item = await CommunityItem.findById(req.params.id);
  if (!item) throw new ApiError(404, "Community item not found.");

  if (item.creator.equals(req.user._id)) {
    throw new ApiError(400, "The creator cannot leave their own item.");
  }

  item.participants.pull(req.user._id);
  await item.save();

  return res.status(200).json(new ApiResponse(200, item, "Left successfully"));
});

module.exports = {
  getCommunityItems,
  getCommunityItem,
  createCommunityItem,
  updateCommunityItem,
  deleteCommunityItem,
  joinCommunityItem,
  leaveCommunityItem,
};
