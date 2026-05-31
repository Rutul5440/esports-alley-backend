const Joi = require("joi");
const ScrimEvent = require("../models/ScrimEvent.model");
const Organization = require("../models/Organization.model");
const PlayerProfile = require("../models/PlayerProfile.model");
const Post = require("../models/Post.model");
const Notification = require("../models/Notification.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const gameIds = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const levels = ["Rookie", "Contender", "Elite", "Master", "Conqueror"];
const levelNames = ["Rookie Grounds", "Contender Arena", "Elite Circuit", "Master League", "Conqueror Invitational"];

const normalizeStatus = (status) => {
  if (!status) return "Open";
  const map = { draft: "draft", open: "open", ongoing: "ongoing", completed: "completed" };
  return map[status] || status;
};

const scrimSchema = Joi.object({
  kind: Joi.string().valid("scrim", "tournament").default("scrim"),
  title: Joi.string().min(3).max(140).required(),
  game: Joi.string().valid(...gameIds).default("bgmi"),
  format: Joi.string().valid("Solo", "Duo", "Squad").default("Squad"),
  level: Joi.alternatives().try(Joi.string().valid(...levels), Joi.object({ tier: Joi.number().min(1).max(5), name: Joi.string().valid(...levelNames) })).default("Rookie"),
  startsAt: Joi.date().optional(),
  scheduledAt: Joi.date().optional(),
  registrationDeadline: Joi.date().optional(),
  prize: Joi.string().max(120).allow("").optional(),
  xpReward: Joi.number().min(0).default(0),
  capacity: Joi.number().min(2).optional(),
  maxTeams: Joi.number().min(2).optional(),
  status: Joi.string().valid("draft", "open", "ongoing", "completed", "Open", "Filling Fast", "Invite Only", "Closed").default("Open"),
  rules: Joi.string().max(5000).allow("").optional(),
  invitedTeams: Joi.array().items(Joi.string().max(80)).default([]),
  isInviteOnly: Joi.boolean().default(false),
});

const getOwnedEvent = async (req, id) => {
  const event = await ScrimEvent.findById(id);
  if (!event) throw new ApiError(404, "Scrim event not found.");
  if (!event.organizer.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "Only the organizer can manage this scrim.");
  }
  return event;
};

const formatScrim = (event) => {
  const json = event.toObject ? event.toObject() : event;
  const registrations = json.registrations || [];
  const capacity = json.maxTeams || json.capacity || 0;
  return {
    ...json,
    id: json._id?.toString() || json.id,
    scheduledAt: json.scheduledAt || json.startsAt,
    startsAt: json.startsAt || json.scheduledAt,
    maxTeams: capacity,
    capacity,
    registered: registrations.length || json.participants?.length || 0,
    registrations,
    level: json.levelDetails || { tier: 1, name: json.level || "Rookie Grounds" },
    legacyLevel: json.level,
  };
};

const getScrims = asyncHandler(async (req, res) => {
  const { game, kind, level, status, includeClosed = "true" } = req.query;
  const filter = {};

  if (game) filter.game = game;
  if (kind) filter.kind = kind;
  if (level) filter.$or = [{ level }, { "levelDetails.name": level }, { "levelDetails.tier": parseInt(level) || -1 }];
  if (status) filter.status = normalizeStatus(status);
  if (includeClosed !== "true") filter.status = { $nin: ["Closed", "completed"] };

  const events = await ScrimEvent.find(filter)
    .populate("organizer", "username avatar role")
    .populate("organization", "name logo")
    .sort({ startsAt: 1 });

  return res.status(200).json(new ApiResponse(200, events.map(formatScrim), "Scrims fetched"));
});

const getScrim = asyncHandler(async (req, res) => {
  const event = await ScrimEvent.findById(req.params.id)
    .populate("organizer", "username avatar role")
    .populate("organization", "name logo")
    .populate("registrations.players", "username avatar");
  if (!event) throw new ApiError(404, "Scrim event not found.");
  return res.status(200).json(new ApiResponse(200, formatScrim(event), "Scrim fetched"));
});

const createScrim = asyncHandler(async (req, res) => {
  const { error, value } = scrimSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  if (!["organization", "admin"].includes(req.user.role)) {
    throw new ApiError(403, "Only organizations and admins can create scrim events.");
  }
  if (req.user.role === "organization" && value.kind !== "scrim") {
    throw new ApiError(403, "Organizations can create scrims only. Tournaments are platform-run.");
  }

  let organization;
  if (req.user.role === "organization") {
    organization = await Organization.findOne({ owner: req.user._id });
    if (!organization) throw new ApiError(404, "Create an organization profile before organizing scrims.");
  }

  const levelInput = value.level;
  const levelTier = typeof levelInput === "object" ? levelInput.tier : Math.max(levels.indexOf(levelInput) + 1, 1);
  const legacyLevel = levels[levelTier - 1] || "Rookie";
  const startsAt = value.startsAt || value.scheduledAt;
  if (!startsAt) throw new ApiError(400, "Scrim date is required.");

  const event = await ScrimEvent.create({
    ...value,
    level: legacyLevel,
    levelDetails: {
      tier: levelTier,
      name: typeof levelInput === "object" ? levelInput.name : levelNames[levelTier - 1],
    },
    startsAt,
    scheduledAt: startsAt,
    capacity: value.capacity || value.maxTeams || 16,
    maxTeams: value.maxTeams || value.capacity || 16,
    status: normalizeStatus(value.status),
    organizer: req.user._id,
    organization: organization?._id,
  });

  if (event.status !== "draft") {
    await Post.create({
      author: req.user._id,
      authorType: req.user.role === "admin" ? "organization" : req.user.role,
      organization: organization?._id,
      content: `${event.title} is open for ${event.game.toUpperCase()} registrations.`,
      body: `${event.title} is open for ${event.game.toUpperCase()} registrations.`,
      game: event.game,
      gameTag: event.game,
      postType: "scrim_announcement",
      linkedScrim: event._id,
      isPublic: true,
    });
  }

  if (organization) {
    await Organization.findByIdAndUpdate(organization._id, { $inc: { "analytics.totalScrims": 1 } });
  }

  return res.status(201).json(new ApiResponse(201, formatScrim(event), "Scrim event created"));
});

const updateScrim = asyncHandler(async (req, res) => {
  const event = await getOwnedEvent(req, req.params.id);
  const { error, value } = scrimSchema.fork(["title"], (schema) => schema.optional()).validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  if (value.scheduledAt && !value.startsAt) value.startsAt = value.scheduledAt;
  if (value.maxTeams && !value.capacity) value.capacity = value.maxTeams;
  if (value.status) value.status = normalizeStatus(value.status);

  Object.assign(event, value);
  await event.save();
  return res.status(200).json(new ApiResponse(200, formatScrim(event), "Scrim updated"));
});

const deleteScrim = asyncHandler(async (req, res) => {
  const event = await getOwnedEvent(req, req.params.id);
  await event.deleteOne();
  return res.status(200).json(new ApiResponse(200, null, "Scrim deleted"));
});

const registerForScrim = asyncHandler(async (req, res) => {
  if (req.user.role !== "player") {
    throw new ApiError(403, "Only players can register for scrims and tournaments.");
  }

  const event = await ScrimEvent.findById(req.params.id);
  if (!event) throw new ApiError(404, "Scrim event not found.");
  if (["Closed", "Invite Only", "draft", "completed"].includes(event.status) || event.isInviteOnly) {
    throw new ApiError(400, "This event is not open for registration.");
  }

  const alreadyRegistered =
    event.participants.some((id) => id.equals(req.user._id)) ||
    event.registrations.some((registration) => registration.players.some((id) => id.equals(req.user._id)));
  if (alreadyRegistered) throw new ApiError(400, "You are already registered for this event.");

  const capacity = event.maxTeams || event.capacity;
  if ((event.registrations.length || event.participants.length) >= capacity) throw new ApiError(400, "This event is full.");

  event.participants.addToSet(req.user._id);
  event.registrations.push({
    teamName: req.body.teamName || `${req.user.username}'s Team`,
    players: req.body.players?.length ? req.body.players : [req.user._id],
    status: "pending",
  });
  if (event.registrations.length >= capacity) event.status = "Closed";
  else if (event.registrations.length / capacity >= 0.8) event.status = "Filling Fast";
  event.analytics.totalRegistrations = event.registrations.length;
  event.analytics.slotFillRate = Math.round((event.registrations.length / capacity) * 100);
  await event.save();

  await PlayerProfile.findOneAndUpdate(
    { user: req.user._id },
    {
      $addToSet: {
        badges: event.level,
        scrimBadges: { scrimId: event._id, tier: event.levelDetails?.tier, tierName: event.levelDetails?.name },
      },
    }
  );

  return res.status(200).json(new ApiResponse(200, formatScrim(event), "Registered for event"));
});

const updateRegistration = asyncHandler(async (req, res) => {
  const event = await getOwnedEvent(req, req.params.id);
  const registration = event.registrations.id(req.params.rid);
  if (!registration) throw new ApiError(404, "Registration not found.");
  const status = req.body.status;
  if (!["pending", "accepted", "rejected"].includes(status)) throw new ApiError(400, "Invalid registration status.");
  registration.status = status;
  await event.save();
  return res.status(200).json(new ApiResponse(200, formatScrim(event), "Registration updated"));
});

const submitResults = asyncHandler(async (req, res) => {
  const event = await getOwnedEvent(req, req.params.id);
  event.results = req.body.results || [];
  event.status = "completed";
  event.analytics.completionRate = event.registrations.length ? Math.round((event.results.length / event.registrations.length) * 100) : 0;
  await event.save();

  const playerIds = event.registrations.flatMap((registration) => registration.players);
  await Notification.insertMany(
    playerIds.map((recipient) => ({
      recipient,
      sender: req.user._id,
      type: "scrim_result",
      message: `${event.title} results are available.`,
      link: `/scrims/${event._id}`,
    }))
  ).catch(() => null);

  return res.status(200).json(new ApiResponse(200, formatScrim(event), "Results submitted"));
});

const getAnalytics = asyncHandler(async (req, res) => {
  const event = await ScrimEvent.findById(req.params.id).populate("registrations.players", "username");
  if (!event) throw new ApiError(404, "Scrim event not found.");

  const registrationsOverTime = event.registrations.reduce((acc, registration) => {
    const date = registration.registeredAt.toISOString().slice(0, 10);
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});
  const performances = event.registrations.flatMap((registration) =>
    registration.players.map((player) => ({
      playerName: player.username,
      kills: registration.performance?.kills || 0,
      damage: registration.performance?.damage || 0,
      placement: registration.performance?.placement || 0,
    }))
  );
  const capacity = event.maxTeams || event.capacity || 1;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        registrationsOverTime: Object.entries(registrationsOverTime).map(([date, count]) => ({ date, count })),
        rankDistribution: [],
        topPerformers: performances.sort((a, b) => b.kills - a.kills || b.damage - a.damage).slice(0, 10),
        avgKD: event.analytics.avgKD || 0,
        avgDamage: event.analytics.avgDamage || event.analytics.averageDamage || 0,
        completionRate: event.analytics.completionRate || 0,
        slotFillRate: Math.round((event.registrations.length / capacity) * 100),
      },
      "Scrim analytics fetched"
    )
  );
});

const getMyScrims = asyncHandler(async (req, res) => {
  const events = await ScrimEvent.find({ organizer: req.user._id }).sort({ startsAt: -1 });
  return res.status(200).json(new ApiResponse(200, events.map(formatScrim), "My scrims fetched"));
});

const getRegisteredScrims = asyncHandler(async (req, res) => {
  const events = await ScrimEvent.find({
    $or: [{ participants: req.user._id }, { "registrations.players": req.user._id }],
  }).sort({ startsAt: -1 });
  return res.status(200).json(new ApiResponse(200, events.map(formatScrim), "Registered scrims fetched"));
});

module.exports = {
  getScrims,
  getScrim,
  createScrim,
  updateScrim,
  deleteScrim,
  registerForScrim,
  updateRegistration,
  submitResults,
  getAnalytics,
  getMyScrims,
  getRegisteredScrims,
};
