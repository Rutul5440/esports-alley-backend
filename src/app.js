const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const errorMiddleware = require("./middlewares/error.middleware");

// Route imports
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const clipRoutes = require("./routes/clip.routes");
const achievementRoutes = require("./routes/achievement.routes");
const organizationRoutes = require("./routes/organization.routes");

const app = express();

// --- Security Middlewares ---
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(morgan("dev"));

// --- Rate Limiting ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use("/api", limiter);

// --- Body Parsers ---
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// --- Routes ---
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/clips", clipRoutes);
app.use("/api/v1/achievements", achievementRoutes);
app.use("/api/v1/organizations", organizationRoutes);

// --- Root and Health Endpoints ---
app.get("/", (req, res) => {
  res.json({ message: "BGMI Platform backend is running", status: "OK" });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// --- Global Error Handler ---
app.use(errorMiddleware);

module.exports = app;