const User = require("../models/User.model");
const PlayerProfile = require("../models/PlayerProfile.model");
const Post = require("../models/Post.model");
const Clip = require("../models/Clip.model");
const Club = require("../models/Club.model");
const ScrimEvent = require("../models/ScrimEvent.model");
const Organization = require("../models/Organization.model");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/v1/search?q=term&type=all|users|posts|clips|scrims|clubs|organizations
const globalSearch = asyncHandler(async (req, res) => {
  const { q, type = "all", page = 1, limit = 20 } = req.query;
  if (!q || q.length < 2) {
    return res.status(200).json(new ApiResponse(200, { results: [] }, "Search query too short"));
  }

  const parsedLimit = Math.min(parseInt(limit), 50);
  const skip = (parseInt(page) - 1) * parsedLimit;
  const regex = new RegExp(q, "i");
  const results = {};

  // Users
  if (type === "all" || type === "users") {
    const users = await User.find({
      $or: [{ username: regex }, { fullName: regex }, { bio: regex }],
    })
      .select("username fullName avatar role bio followers")
      .limit(type === "all" ? 5 : parsedLimit)
      .skip(type === "all" ? 0 : skip)
      .sort({ createdAt: -1 });
    results.users = users.map((u) => ({
      ...u.toObject(),
      type: "user",
      followers: u.followers?.length || 0,
    }));
  }

  // Posts
  if (type === "all" || type === "posts") {
    const posts = await Post.find({
      $or: [{ content: regex }, { body: regex }, { tags: regex }],
      isPublic: true,
    })
      .populate("author", "username avatar")
      .select("content body gameTag tags likes author createdAt postType")
      .limit(type === "all" ? 5 : parsedLimit)
      .skip(type === "all" ? 0 : skip)
      .sort({ createdAt: -1 });
    results.posts = posts.map((p) => ({ ...p.toObject(), type: "post", likes: p.likes?.length || 0 }));
  }

  // Clips
  if (type === "all" || type === "clips") {
    const clips = await Clip.find({
      $or: [{ title: regex }, { description: regex }, { tags: regex }],
      isPublic: true,
    })
      .populate("uploader", "username avatar")
      .select("title thumbnailUrl views game uploader createdAt")
      .limit(type === "all" ? 5 : parsedLimit)
      .skip(type === "all" ? 0 : skip)
      .sort({ views: -1, createdAt: -1 });
    results.clips = clips.map((c) => ({ ...c.toObject(), type: "clip" }));
  }

  // Scrims
  if (type === "all" || type === "scrims") {
    const scrims = await ScrimEvent.find({
      $or: [{ title: regex }],
    })
      .populate("organizer", "username avatar")
      .select("title game level status startsAt capacity organizer")
      .limit(type === "all" ? 5 : parsedLimit)
      .skip(type === "all" ? 0 : skip)
      .sort({ startsAt: -1 });
    results.scrims = scrims.map((s) => ({ ...s.toObject(), type: "scrim" }));
  }

  // Clubs
  if (type === "all" || type === "clubs") {
    const clubs = await Club.find({
      $or: [{ name: regex }, { description: regex }, { tags: regex }],
      isPrivate: false,
    })
      .populate("creator", "username avatar")
      .select("name gameTag memberCount creator description")
      .limit(type === "all" ? 5 : parsedLimit)
      .skip(type === "all" ? 0 : skip)
      .sort({ memberCount: -1 });
    results.clubs = clubs.map((c) => ({ ...c.toObject(), type: "club" }));
  }

  // Organizations
  if (type === "all" || type === "organizations") {
    const orgs = await Organization.find({
      $or: [{ name: regex }, { description: regex }],
    })
      .populate("owner", "username avatar")
      .select("name logo description country isVerified activeGames owner")
      .limit(type === "all" ? 5 : parsedLimit)
      .skip(type === "all" ? 0 : skip)
      .sort({ isVerified: -1, createdAt: -1 });
    results.organizations = orgs.map((o) => ({ ...o.toObject(), type: "organization" }));
  }

  return res.status(200).json(new ApiResponse(200, results, "Search results"));
});

module.exports = { globalSearch };
