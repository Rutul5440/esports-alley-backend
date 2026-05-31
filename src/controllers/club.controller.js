const Joi = require("joi");
const Club = require("../models/Club.model");
const Post = require("../models/Post.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const gameIds = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];

const clubSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(800).allow("").default(""),
  banner: Joi.string().allow("").default(""),
  gameTag: Joi.string().valid(...gameIds).default("bgmi"),
  isPrivate: Joi.boolean().default(false),
  rules: Joi.string().max(2000).allow("").default(""),
  tags: Joi.array().items(Joi.string().max(40)).default([]),
});

const eventSchema = Joi.object({
  type: Joi.string().valid("watch_party", "collab", "team_up", "general").default("general"),
  title: Joi.string().min(2).max(140).required(),
  description: Joi.string().max(800).allow("").default(""),
  game: Joi.string().valid(...gameIds).default("bgmi"),
  scheduledAt: Joi.date().required(),
  link: Joi.string().allow("").default(""),
  maxAttendees: Joi.number().min(0).optional(),
  requirements: Joi.object({
    minFollowers: Joi.number().min(0).optional(),
    rank: Joi.string().allow("").optional(),
    role: Joi.string().allow("").optional(),
  }).optional(),
});

const isClubAdmin = (club, user) =>
  user.role === "admin" || club.creator.equals(user._id) || club.admins.some((id) => id.equals(user._id));

const getOwnedClub = async (req, id, creatorOnly = false) => {
  const club = await Club.findById(id);
  if (!club) throw new ApiError(404, "Club not found.");
  if (creatorOnly ? !club.creator.equals(req.user._id) && req.user.role !== "admin" : !isClubAdmin(club, req.user)) {
    throw new ApiError(403, "You cannot manage this club.");
  }
  return club;
};

const createClub = asyncHandler(async (req, res) => {
  const { error, value } = clubSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const club = await Club.create({
    ...value,
    creator: req.user._id,
    admins: [req.user._id],
    members: [req.user._id],
  });
  return res.status(201).json(new ApiResponse(201, club, "Club created"));
});

const listClubs = asyncHandler(async (req, res) => {
  const { game, q, includePrivate = "false" } = req.query;
  const filter = {};
  if (includePrivate !== "true") filter.isPrivate = false;
  if (game) filter.gameTag = game;
  if (q) filter.name = { $regex: q, $options: "i" };

  const clubs = await Club.find(filter).populate("creator", "username avatar").sort({ memberCount: -1, createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, clubs, "Clubs fetched"));
});

const getClub = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id)
    .populate("creator", "username avatar")
    .populate("admins", "username avatar")
    .populate("members", "username avatar role")
    .populate("events.host", "username avatar");
  if (!club) throw new ApiError(404, "Club not found.");
  if (club.isPrivate && !club.members.some((id) => id._id?.equals(req.user._id) || id.equals?.(req.user._id))) {
    throw new ApiError(403, "This club is private.");
  }
  return res.status(200).json(new ApiResponse(200, club, "Club fetched"));
});

const updateClub = asyncHandler(async (req, res) => {
  const club = await getOwnedClub(req, req.params.id);
  const schema = clubSchema.fork(["name"], (s) => s.optional());
  const { error, value } = schema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);
  Object.assign(club, value);
  await club.save();
  return res.status(200).json(new ApiResponse(200, club, "Club updated"));
});

const deleteClub = asyncHandler(async (req, res) => {
  const club = await getOwnedClub(req, req.params.id, true);
  await club.deleteOne();
  return res.status(200).json(new ApiResponse(200, null, "Club deleted"));
});

const joinClub = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id);
  if (!club) throw new ApiError(404, "Club not found.");
  club.members.addToSet(req.user._id);
  await club.save();
  return res.status(200).json(new ApiResponse(200, club, "Joined club"));
});

const leaveClub = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id);
  if (!club) throw new ApiError(404, "Club not found.");
  if (club.creator.equals(req.user._id)) throw new ApiError(400, "Club creator cannot leave their own club.");
  club.members.pull(req.user._id);
  club.admins.pull(req.user._id);
  await club.save();
  return res.status(200).json(new ApiResponse(200, club, "Left club"));
});

const listMembers = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id).populate("members", "username avatar role");
  if (!club) throw new ApiError(404, "Club not found.");
  return res.status(200).json(new ApiResponse(200, club.members, "Club members fetched"));
});

const createEvent = asyncHandler(async (req, res) => {
  const club = await getOwnedClub(req, req.params.id);
  const { error, value } = eventSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);
  club.events.push({ ...value, host: req.user._id, attendees: [req.user._id] });
  await club.save();
  return res.status(201).json(new ApiResponse(201, club.events.at(-1), "Club event created"));
});

const updateEvent = asyncHandler(async (req, res) => {
  const club = await getOwnedClub(req, req.params.id);
  const event = club.events.id(req.params.eid);
  if (!event) throw new ApiError(404, "Event not found.");
  const { error, value } = eventSchema.fork(["title", "scheduledAt"], (s) => s.optional()).validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);
  Object.assign(event, value);
  await club.save();
  return res.status(200).json(new ApiResponse(200, event, "Club event updated"));
});

const deleteEvent = asyncHandler(async (req, res) => {
  const club = await getOwnedClub(req, req.params.id);
  const event = club.events.id(req.params.eid);
  if (!event) throw new ApiError(404, "Event not found.");
  event.deleteOne();
  await club.save();
  return res.status(200).json(new ApiResponse(200, club.events, "Club event deleted"));
});

const toggleAttend = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id);
  if (!club) throw new ApiError(404, "Club not found.");
  const event = club.events.id(req.params.eid);
  if (!event) throw new ApiError(404, "Event not found.");
  const attending = event.attendees.some((id) => id.equals(req.user._id));
  attending ? event.attendees.pull(req.user._id) : event.attendees.addToSet(req.user._id);
  await club.save();
  return res.status(200).json(new ApiResponse(200, { attending: !attending, event }, attending ? "Attendance removed" : "Attendance added"));
});

const createClubPost = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id);
  if (!club) throw new ApiError(404, "Club not found.");
  if (!club.members.some((id) => id.equals(req.user._id))) throw new ApiError(403, "Join the club before posting.");

  const content = req.body.content || req.body.body;
  if (!content) throw new ApiError(400, "Post content is required.");
  const post = await Post.create({
    author: req.user._id,
    authorType: req.user.role === "organization" ? "organization" : "player",
    content,
    body: content,
    game: req.body.gameTag || club.gameTag,
    gameTag: req.body.gameTag || club.gameTag,
    tags: req.body.tags || [],
    postType: req.body.postType || "general",
    clubId: club._id,
    isPublic: !club.isPrivate,
  });
  return res.status(201).json(new ApiResponse(201, post, "Club post created"));
});

const getClubPosts = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id);
  if (!club) throw new ApiError(404, "Club not found.");
  const posts = await Post.find({ clubId: club._id }).populate("author", "username avatar role").sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, posts, "Club posts fetched"));
});

module.exports = {
  createClub,
  listClubs,
  getClub,
  updateClub,
  deleteClub,
  joinClub,
  leaveClub,
  listMembers,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleAttend,
  createClubPost,
  getClubPosts,
};
