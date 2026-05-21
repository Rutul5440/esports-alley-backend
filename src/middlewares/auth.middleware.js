const { verifyToken } = require("../services/token.service");
const User = require("../models/User.model");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) throw new ApiError(401, "Not authorized. Token missing.");

  const decoded = verifyToken(token);
  const user = await User.findById(decoded.id);

  if (!user) throw new ApiError(401, "User no longer exists.");

  req.user = user;
  next();
});

module.exports = { protect };