const ApiError = require("../utils/ApiError");

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "You don't have permission to perform this action.");
    }
    next();
  };
};

module.exports = { restrictTo };