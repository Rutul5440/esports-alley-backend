const jwt = require("jsonwebtoken");

const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || "your_super_secret_key_here",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || "your_super_secret_key_here");
};

module.exports = { generateToken, verifyToken };