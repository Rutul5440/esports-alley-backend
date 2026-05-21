const User = require("../models/User.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { generateToken } = require("../services/token.service");

const toAuthPayload = (user) => ({
  user: {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  },
  token: generateToken(user._id, user.role),
});

// POST /api/v1/auth/register
const register = asyncHandler(async (req, res) => {
  const { username, email, password, role = "player" } = req.body;

  if (!username || !email || !password) {
    throw new ApiError(400, "Username, email, and password are required.");
  }

  const user = await User.create({ username, email, password, role });

  return res
    .status(201)
    .json(new ApiResponse(201, toAuthPayload(user), "Registered successfully"));
});

// POST /api/v1/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required.");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, toAuthPayload(user), "Logged in successfully"));
});

// GET /api/v1/auth/me
const getMe = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, toAuthPayload(req.user), "Current user fetched"));
});

// POST /api/v1/auth/follow/:userId
const toggleFollow = asyncHandler(async (req, res) => {
  if (req.params.userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot follow yourself.");
  }

  const targetUser = await User.findById(req.params.userId);
  if (!targetUser) throw new ApiError(404, "User not found.");

  const isFollowing = req.user.following.some((id) => id.equals(targetUser._id));

  const pullOrPush = isFollowing ? "$pull" : "$push";

  await User.findByIdAndUpdate(req.user._id, { [pullOrPush]: { following: targetUser._id } });
  await User.findByIdAndUpdate(targetUser._id, { [pullOrPush]: { followers: req.user._id } });

  return res.status(200).json(
    new ApiResponse(200, null, isFollowing ? "Unfollowed" : "Followed")
  );
});

module.exports = { register, login, getMe, toggleFollow };
