const express = require("express");
const router = express.Router();
const { globalSearch } = require("../controllers/search.controller");

// Public — global search
router.get("/", globalSearch);

module.exports = router;
