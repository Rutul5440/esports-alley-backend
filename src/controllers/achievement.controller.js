const Achievement = require("../models/Achievement.model");
const PlayerProfile = require("../models/PlayerProfile.model");
const { uploadToCloudinary } = require("../services/upload.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const Joi = require("joi");

// Validation
const achievementSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(300).optional(),
  badge: Joi.string()
    .valid("Tournament Winner", "Top Fragger", "Conqueror Badge", "MVP", "Custom")
    .default("Custom"),
  earnedAt: Joi.date().optional(),
});

// POST /api/v1/achievements — Add achievement
const addAchievement = asyncHandler(async (req, res) => {
  const { error, value } = achievementSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  let proofImage = "";
  if (req.file) {
    const result = await uploadToCloudinary(
      req.file.buffer,
      "bgmi/achievements",
      "image"
    );
    proofImage = result.secure_url;
  }

  const achievement = await Achievement.create({
    player: req.user._id,
    ...value,
    proofImage,
  });

  // Push to player profile
  await PlayerProfile.findOneAndUpdate(
    { user: req.user._id },
    { $push: { achievements: achievement._id } }
  );

  return res
    .status(201)
    .json(new ApiResponse(201, achievement, "Achievement added"));
});

// GET /api/v1/achievements/:userId — Get all achievements of a player
const getAchievements = asyncHandler(async (req, res) => {
  const achievements = await Achievement.find({
    player: req.params.userId,
  }).sort({ earnedAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, achievements, "Achievements fetched"));
});

// DELETE /api/v1/achievements/:achievementId — Delete own achievement
const deleteAchievement = asyncHandler(async (req, res) => {
  const achievement = await Achievement.findById(req.params.achievementId);
  if (!achievement) throw new ApiError(404, "Achievement not found.");

  if (achievement.player.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only delete your own achievements.");
  }

  await achievement.deleteOne();

  // Remove from player profile
  await PlayerProfile.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { achievements: achievement._id } }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Achievement deleted"));
});

// PATCH /api/v1/achievements/:achievementId/verify — Admin verifies achievement
const verifyAchievement = asyncHandler(async (req, res) => {
  const achievement = await Achievement.findByIdAndUpdate(
    req.params.achievementId,
    { verifiedByOrg: true },
    { new: true }
  );
  if (!achievement) throw new ApiError(404, "Achievement not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, achievement, "Achievement verified"));
});

module.exports = {
  addAchievement,
  getAchievements,
  deleteAchievement,
  verifyAchievement,
};