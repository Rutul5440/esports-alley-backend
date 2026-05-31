const express = require("express");
const router = express.Router();
const { getFeed } = require("../controllers/post.controller");
const { protect } = require("../middlewares/auth.middleware");

router.get("/", protect, getFeed);

module.exports = router;
