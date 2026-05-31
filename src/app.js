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
const feedRoutes = require("./routes/feed.routes");
const postRoutes = require("./routes/post.routes");
const communityRoutes = require("./routes/community.routes");
const scrimRoutes = require("./routes/scrim.routes");
const clubRoutes = require("./routes/club.routes");
const notificationRoutes = require("./routes/notification.routes");
const scoutingRoutes = require("./routes/scouting.routes");
const gameRoutes = require("./routes/game.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const searchRoutes = require("./routes/search.routes");

const app = express();

// --- Security Middlewares ---
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(morgan("dev"));

// --- Rate Limiting ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "development" ? 10000 : 100, // high threshold for dev/active testing
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
app.use("/api/v1/feed", feedRoutes);
app.use("/api/v1/posts", postRoutes);
app.use("/api/v1/community", communityRoutes);
app.use("/api/v1/clubs", clubRoutes);
app.use("/api/v1/scrims", scrimRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/scouting", scoutingRoutes);
app.use("/api/v1/games", gameRoutes);
app.use("/api/v1/leaderboard", leaderboardRoutes);
app.use("/api/v1/search", searchRoutes);

// --- Root and Health Endpoints ---
app.get("/", (req, res) => {
  res.json({ message: "ConqLink Platform backend is running", status: "OK" });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// --- Global Error Handler ---
app.use(errorMiddleware);

module.exports = app;
