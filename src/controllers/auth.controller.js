const User = require("../models/User.model");
const PlayerProfile = require("../models/PlayerProfile.model");
const Organization = require("../models/Organization.model");
const { uploadToCloudinary } = require("../services/upload.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { generateToken } = require("../services/token.service");

const allowedRoles = ["player", "organization", "admin"];

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
  const { username, email, password, role = "player", fullName, country, dateOfBirth } = req.body;

  if (!username || !email || !password) {
    throw new ApiError(400, "Username, email, and password are required.");
  }
  if (!allowedRoles.includes(role)) {
    throw new ApiError(400, "Role must be player, organization, or admin.");
  }

  const sanitizedUsername = String(username).trim().toLowerCase();
  const sanitizedEmail = String(email).trim().toLowerCase();

  const existing = await User.findOne({ $or: [{ username: sanitizedUsername }, { email: sanitizedEmail }] });
  if (existing) throw new ApiError(409, "Username or email is already in use.");

  const user = await User.create({
    username: sanitizedUsername,
    email: sanitizedEmail,
    password,
    role,
    fullName: fullName ? String(fullName).trim() : undefined,
    country: country ? String(country).trim() : undefined,
    dateOfBirth,
  });

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

  const sanitizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: sanitizedEmail }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, toAuthPayload(user), "Logged in successfully"));
});

// POST /api/v1/auth/google-login
const googleLogin = asyncHandler(async (req, res) => {
  const { email, username, fullName, avatar } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required.");
  }

  let user = await User.findOne({ email: email.toLowerCase() });
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    
    // Generate clean, unique username
    let cleanUsername = (username || email.split("@")[0] || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (cleanUsername.length < 3) cleanUsername += "gamer";
    
    let exists = await User.exists({ username: cleanUsername });
    let counter = 1;
    let finalUsername = cleanUsername;
    while (exists) {
      finalUsername = `${cleanUsername}${counter}`;
      exists = await User.exists({ username: finalUsername });
      counter++;
    }

    const randomPassword = Math.random().toString(36).slice(-10) + "A1!";
    
    user = await User.create({
      username: finalUsername,
      email: email.toLowerCase(),
      password: randomPassword,
      fullName: fullName || email.split("@")[0],
      avatar: avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${finalUsername}`,
      role: "player",
    });

    // Auto-seed a PlayerProfile for Google registration
    await PlayerProfile.create({
      user: user._id,
      displayName: user.fullName || user.username,
      preferredGames: ["bgmi"],
      isOpenToTeam: true,
      openToTeam: true,
      isOpenToRecruit: true,
    });

    user.profileCompleted = true;
    await user.save();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { ...toAuthPayload(user), isNewUser }, "Google authentication successful"));
});

// GET /api/v1/auth/me
const getMe = asyncHandler(async (req, res) => {
  let profile = null;
  if (req.user.role === "player") {
    profile = await PlayerProfile.findOne({ user: req.user._id });
  }
  if (req.user.role === "organization") {
    profile = await Organization.findOne({ owner: req.user._id });
  }
  return res
    .status(200)
    .json(new ApiResponse(200, { ...toAuthPayload(req.user), profile }, "Current user fetched"));
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

  // Create Follow Notification if starting to follow
  if (!isFollowing) {
    const Notification = require("../models/Notification.model");
    await Notification.create({
      recipient: targetUser._id,
      sender: req.user._id,
      type: "follow",
      message: `@${req.user.username} started following you.`,
      link: `/profile/${req.user.username}`,
    });
  }

  return res.status(200).json(
    new ApiResponse(200, null, isFollowing ? "Unfollowed" : "Followed")
  );
});

const checkUsername = asyncHandler(async (req, res) => {
  const username = String(req.body.username || req.query.username || "").trim().toLowerCase();
  if (!username || username.length < 3) throw new ApiError(400, "Username must be at least 3 characters.");

  const exists = await User.exists({ username });
  return res.status(200).json(new ApiResponse(200, { username, available: !exists }, "Username checked"));
});

const completeProfile = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  const userUpdates = {};
  ["fullName", "country", "dateOfBirth", "gamePreferences", "playStyle", "languages", "openToTeam"].forEach((key) => {
    if (payload[key] !== undefined) userUpdates[key] = payload[key];
  });

  if (req.user.role === "player") {
    const profilePayload = {
      displayName: payload.displayName || payload.fullName || req.user.username,
      bio: payload.bio,
      country: payload.country,
      bgmiUID: payload.bgmiUID ? String(payload.bgmiUID).trim() : undefined,
      role: payload.role,
      roles: payload.roles || (payload.role ? [payload.role] : undefined),
      preferredGames: payload.preferredGames,
      preferredMode: payload.preferredMode,
      socialLinks: payload.socialLinks,
      isOpenToRecruit: payload.openToRecruit,
      isOpenToTeam: payload.openToTeam,
      openToTeam: payload.openToTeam,
      playStyle: payload.playStyle,
      languages: payload.languages,
      gameStats: payload.gameStats || payload.gamePreferences,
      bannerImage: payload.bannerImage,
    };

    await PlayerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: profilePayload, $setOnInsert: { user: req.user._id } },
      { upsert: true, new: true, runValidators: true }
    );
  }

  if (req.user.role === "organization") {
    await Organization.findOneAndUpdate(
      { owner: req.user._id },
      {
        $set: {
          name: payload.name || payload.organizationName || req.user.username,
          description: payload.description,
          country: payload.country,
          orgType: payload.orgType,
          website: payload.website,
          foundedYear: payload.foundedYear,
          socialLinks: payload.socialLinks,
          activeGames: payload.activeGames || payload.games,
          openRoles: payload.openRoles || payload.rolesLookingFor,
          recruitmentRegions: payload.recruitmentRegions,
          recruitmentCriteria: payload.recruitmentCriteria,
          bannerImage: payload.bannerImage,
          ownerOrgRole: payload.ownerOrgRole,
          purposes: payload.purposes,
          isRecruiting: payload.isRecruiting,
        },
        $setOnInsert: { owner: req.user._id },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { ...userUpdates, profileCompleted: true } },
    { new: true, runValidators: true }
  );

  return res.status(200).json(new ApiResponse(200, toAuthPayload(user), "Profile completed"));
});

const updateGamePreferences = asyncHandler(async (req, res) => {
  const gamePreferences = req.body.gamePreferences || [];
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { gamePreferences } }, { new: true, runValidators: true });
  await PlayerProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: { gameStats: gamePreferences, preferredGames: gamePreferences.map((item) => item.game).filter(Boolean) } },
    { new: true, runValidators: true }
  );
  return res.status(200).json(new ApiResponse(200, toAuthPayload(user), "Game preferences updated"));
});

const uploadUserImage = (field, folder) =>
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Image file is required.");
    const result = await uploadToCloudinary(req.file.buffer, folder, "image");
    const url = result.secure_url;

    const userUpdate = field === "avatar" ? { avatar: url } : { bannerImage: url };
    const user = await User.findByIdAndUpdate(req.user._id, { $set: userUpdate }, { new: true });

    if (req.user.role === "player") {
      const profileUpdate = field === "avatar" ? {} : { bannerImage: url };
      if (Object.keys(profileUpdate).length) {
        await PlayerProfile.findOneAndUpdate({ user: req.user._id }, { $set: profileUpdate });
      }
    }
    if (req.user.role === "organization" && field !== "avatar") {
      await Organization.findOneAndUpdate({ owner: req.user._id }, { $set: { bannerImage: url } });
    }

    return res.status(200).json(new ApiResponse(200, { url, user: toAuthPayload(user).user }, `${field} uploaded`));
  });

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  toggleFollow,
  checkUsername,
  completeProfile,
  updateGamePreferences,
  uploadAvatar: uploadUserImage("avatar", "bgmi/avatars"),
  uploadBanner: uploadUserImage("bannerImage", "bgmi/banners"),
};
