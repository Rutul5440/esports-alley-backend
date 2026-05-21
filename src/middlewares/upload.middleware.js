const multer = require("multer");
const ApiError = require("../utils/ApiError");

const storage = multer.memoryStorage(); // Buffer in memory, then push to Cloudinary

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "clip") {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new ApiError(400, "Only video files allowed for clips."), false);
    }
  } else if (file.fieldname === "thumbnail" || file.fieldname === "avatar") {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new ApiError(400, "Only image files allowed."), false);
    }
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
});

module.exports = upload;