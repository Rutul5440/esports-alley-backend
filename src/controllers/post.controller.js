const Joi = require("joi");
const Post = require("../models/Post.model");
const Organization = require("../models/Organization.model");
const User = require("../models/User.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const gameIds = ["bgmi", "valorant", "cs2", "free-fire", "apex-legends", "pubg-ns"];
const postTypes = ["general", "recruitment", "achievement", "scrim_announcement", "clip"];

const postSchema = Joi.object({
  game: Joi.string().valid(...gameIds).optional(),
  gameTag: Joi.string().valid(...gameIds).optional(),
  body: Joi.string().min(1).max(2000).optional(),
  content: Joi.string().min(1).max(2000).optional(),
  image: Joi.string().uri().allow("").optional(),
  mediaUrls: Joi.array().items(Joi.string().uri()).default([]),
  tags: Joi.array().items(Joi.string().max(40)).default([]),
  postType: Joi.string().valid(...postTypes).default("general"),
  poll: Joi.object({
    question: Joi.string().max(200).required(),
    options: Joi.array().items(Joi.object({ text: Joi.string().max(120).required() })).min(2).max(6).required(),
    expiresAt: Joi.date().optional(),
  }).optional(),
  linkedScrim: Joi.string().optional(),
  linkedAchievement: Joi.string().optional(),
  clubId: Joi.string().optional(),
  isPublic: Joi.boolean().default(true),
});

const populatePost = (query) =>
  query
    .populate("author", "username avatar role followers following")
    .populate("organization", "name logo isVerified")
    .populate("linkedScrim", "title game startsAt scheduledAt level levelDetails capacity maxTeams participants registrations status")
    .populate("linkedAchievement", "title tier")
    .populate("comments.user", "username avatar");

const formatPost = (post, viewerId) => {
  const json = post.toObject ? post.toObject() : post;
  const likes = json.likes || [];
  const saves = json.saves || [];
  const mediaUrls = json.mediaUrls?.length ? json.mediaUrls : json.image ? [json.image] : [];
  return {
    id: json._id?.toString() || json.id,
    authorId: json.author?._id?.toString() ?? json.author?.toString(),
    authorType: json.authorType,
    authorName: json.organization?.name ?? json.author?.username ?? "Unknown",
    authorHandle: json.author?.username ?? "",
    authorAvatar: json.organization?.logo || json.author?.avatar || "",
    authorMeta: json.authorType === "organization" ? "Organization" : json.author?.role === "player" ? "Player" : json.author?.role,
    organization: json.organization,
    game: json.gameTag || json.game,
    gameTag: json.gameTag || json.game,
    body: json.content || json.body || "",
    content: json.content || json.body || "",
    image: json.image || mediaUrls[0] || "",
    mediaUrls,
    postType: json.postType || "general",
    tags: json.tags || [],
    likes: likes.length,
    likedByMe: viewerId ? likes.some((id) => id.toString() === viewerId.toString()) : false,
    comments: json.comments?.length || 0,
    commentsList: json.comments || [],
    reposts: json.shares ?? json.reposts ?? 0,
    shares: json.shares ?? json.reposts ?? 0,
    saves: saves.length,
    savedByMe: viewerId ? saves.some((id) => id.toString() === viewerId.toString()) : false,
    poll: json.poll,
    linkedScrim: json.linkedScrim,
    linkedAchievement: json.linkedAchievement,
    clubId: json.clubId,
    isPublic: json.isPublic,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
};

const buildFeedFilter = async (req) => {
  const { game, games, cursor } = req.query;
  const filter = { isPublic: true };
  const selectedGames = game ? [game] : games ? String(games).split(",") : [];
  const validGames = selectedGames.filter((item) => gameIds.includes(item));

  if (validGames.length) filter.gameTag = { $in: validGames };
  if (cursor) filter.createdAt = { $lt: new Date(cursor) };

  if (req.user.role === "organization") {
    filter.authorType = "organization";
    return filter;
  }

  const followed = [...(req.user.following || []), req.user._id];
  const followedOrgs = await Organization.find({ owner: { $in: followed } }).select("_id");
  filter.$or = [
    { author: { $in: followed } },
    { organization: { $in: followedOrgs.map((org) => org._id) } },
    { authorType: "organization", postType: { $in: ["recruitment", "scrim_announcement"] } },
  ];
  return filter;
};

// GET /api/v1/posts/feed and legacy GET /api/v1/feed
const getFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const parsedLimit = Math.min(parseInt(limit), 50);
  const filter = await buildFeedFilter(req);

  const query = populatePost(Post.find(filter)).sort({ createdAt: -1 }).limit(parsedLimit);
  if (!req.query.cursor) query.skip((parseInt(page) - 1) * parsedLimit);

  const posts = await query;
  const total = req.query.cursor ? undefined : await Post.countDocuments(filter);
  const nextCursor = posts.length === parsedLimit ? posts[posts.length - 1].createdAt : null;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: posts.map((post) => formatPost(post, req.user._id)),
        total,
        page: parseInt(page),
        pages: total ? Math.ceil(total / parsedLimit) : undefined,
        nextCursor,
      },
      "Feed fetched"
    )
  );
});

const createPost = asyncHandler(async (req, res) => {
  if (!["player", "organization"].includes(req.user.role)) {
    throw new ApiError(403, "Only players and organizations can create posts.");
  }

  const { error, value } = postSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const content = value.content || value.body;
  if (!content && !value.mediaUrls?.length && !value.poll) {
    throw new ApiError(400, "Post content, media, or poll is required.");
  }

  let organization;
  if (req.user.role === "organization") {
    organization = await Organization.findOne({ owner: req.user._id });
  }

  const gameTag = value.gameTag || value.game || "bgmi";
  const post = await Post.create({
    ...value,
    body: content,
    content,
    game: gameTag,
    gameTag,
    image: value.image || value.mediaUrls?.[0],
    poll: value.poll
      ? { ...value.poll, options: value.poll.options.map((option) => ({ text: option.text, votes: [] })) }
      : undefined,
    author: req.user._id,
    authorType: req.user.role,
    organization: organization?._id,
  });

  const populated = await populatePost(Post.findById(post._id));
  return res.status(201).json(new ApiResponse(201, formatPost(populated, req.user._id), "Post created"));
});

const getPost = asyncHandler(async (req, res) => {
  const post = await populatePost(Post.findById(req.params.id || req.params.postId));
  if (!post) throw new ApiError(404, "Post not found.");
  return res.status(200).json(new ApiResponse(200, formatPost(post, req.user?._id), "Post fetched"));
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id || req.params.postId);
  if (!post) throw new ApiError(404, "Post not found.");
  if (!post.author.equals(req.user._id) && req.user.role !== "admin") throw new ApiError(403, "You can delete only your own posts.");
  await post.deleteOne();
  return res.status(200).json(new ApiResponse(200, null, "Post deleted"));
});

const updatePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id || req.params.postId);
  if (!post) throw new ApiError(404, "Post not found.");
  if (!post.author.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You can edit only your own posts.");
  }

  const { content, body, tags, gameTag, game, image, mediaUrls } = req.body;
  if (content || body) { post.content = content || body; post.body = content || body; }
  if (tags) post.tags = tags;
  if (gameTag || game) { post.gameTag = gameTag || game; post.game = gameTag || game; }
  if (image) post.image = image;
  if (mediaUrls) post.mediaUrls = mediaUrls;

  await post.save();
  const populated = await populatePost(Post.findById(post._id));
  return res.status(200).json(new ApiResponse(200, formatPost(populated, req.user._id), "Post updated"));
});

const getPostsByUser = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const parsedLimit = Math.min(parseInt(limit), 50);
  const filter = { author: req.params.userId, isPublic: true };

  const posts = await populatePost(Post.find(filter))
    .sort({ createdAt: -1 })
    .skip((parseInt(page) - 1) * parsedLimit)
    .limit(parsedLimit);

  const total = await Post.countDocuments(filter);
  const viewerId = req.user?._id;

  return res.status(200).json(
    new ApiResponse(200, {
      posts: posts.map((post) => formatPost(post, viewerId)),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parsedLimit),
    }, "User posts fetched")
  );
});

const togglePostLike = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id || req.params.postId);
  if (!post) throw new ApiError(404, "Post not found.");

  const alreadyLiked = post.likes.some((id) => id.equals(req.user._id));
  await post.updateOne(alreadyLiked ? { $pull: { likes: req.user._id } } : { $addToSet: { likes: req.user._id } });

  // Create Like Notification (only on new likes, and only if liking someone else's post)
  if (!alreadyLiked && !post.author.equals(req.user._id)) {
    const Notification = require("../models/Notification.model");
    await Notification.create({
      recipient: post.author,
      sender: req.user._id,
      type: "like",
      message: `@${req.user.username} liked your post.`,
      link: "/dashboard",
    });
  }

  return res.status(200).json(new ApiResponse(200, { liked: !alreadyLiked }, alreadyLiked ? "Post unliked" : "Post liked"));
});

const togglePostCommentLike = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id || req.params.postId);
  if (!post) throw new ApiError(404, "Post not found.");

  const comment = post.comments.id(req.params.cid || req.params.commentId);
  if (!comment) throw new ApiError(404, "Comment not found.");

  if (!comment.likes) comment.likes = [];
  const alreadyLiked = comment.likes.some((id) => id.equals(req.user._id));

  if (alreadyLiked) {
    comment.likes = comment.likes.filter((id) => !id.equals(req.user._id));
  } else {
    comment.likes.push(req.user._id);

    // Create Comment Like Notification (only if liking someone else's comment)
    if (!comment.user.equals(req.user._id)) {
      const Notification = require("../models/Notification.model");
      const previewText = comment.text.length > 30 ? `${comment.text.slice(0, 30)}...` : comment.text;
      await Notification.create({
        recipient: comment.user,
        sender: req.user._id,
        type: "like",
        message: `@${req.user.username} liked your comment: "${previewText}"`,
        link: "/dashboard",
      });
    }
  }

  await post.save();

  return res.status(200).json(
    new ApiResponse(200, { liked: !alreadyLiked, likesCount: comment.likes.length }, alreadyLiked ? "Comment unliked" : "Comment liked")
  );
});

const addPostComment = asyncHandler(async (req, res) => {
  if (!req.body.text) throw new ApiError(400, "Comment text is required.");

  const post = await Post.findById(req.params.id || req.params.postId);
  if (!post) throw new ApiError(404, "Post not found.");

  post.comments.push({ user: req.user._id, text: req.body.text });
  await post.save();

  // Create Comment Notification (only if commenting on someone else's post)
  if (!post.author.equals(req.user._id)) {
    const Notification = require("../models/Notification.model");
    const previewText = req.body.text.length > 30 ? `${req.body.text.slice(0, 30)}...` : req.body.text;
    await Notification.create({
      recipient: post.author,
      sender: req.user._id,
      type: "comment",
      message: `@${req.user.username} commented on your post: "${previewText}"`,
      link: "/dashboard",
    });
  }

  return res.status(201).json(new ApiResponse(201, post.comments, "Comment added"));
});

const deletePostComment = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id || req.params.postId);
  if (!post) throw new ApiError(404, "Post not found.");

  const comment = post.comments.id(req.params.cid);
  if (!comment) throw new ApiError(404, "Comment not found.");
  if (!comment.user.equals(req.user._id) && !post.author.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot delete this comment.");
  }

  comment.deleteOne();
  await post.save();
  return res.status(200).json(new ApiResponse(200, post.comments, "Comment deleted"));
});

const toggleSavePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id || req.params.postId);
  if (!post) throw new ApiError(404, "Post not found.");

  const alreadySaved = post.saves.some((id) => id.equals(req.user._id));
  const update = alreadySaved ? { $pull: { saves: req.user._id } } : { $addToSet: { saves: req.user._id } };
  await Post.findByIdAndUpdate(post._id, update);
  await User.findByIdAndUpdate(req.user._id, alreadySaved ? { $pull: { savedPosts: post._id } } : { $addToSet: { savedPosts: post._id } });

  return res.status(200).json(new ApiResponse(200, { saved: !alreadySaved }, alreadySaved ? "Post unsaved" : "Post saved"));
});

const sharePost = asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndUpdate(
    req.params.id || req.params.postId,
    { $inc: { shares: 1, reposts: 1 } },
    { new: true }
  );
  if (!post) throw new ApiError(404, "Post not found.");
  return res.status(200).json(new ApiResponse(200, { shares: post.shares }, "Post shared"));
});

const votePoll = asyncHandler(async (req, res) => {
  const { optionId, optionIndex } = req.body;
  const post = await Post.findById(req.params.id || req.params.postId);
  if (!post?.poll?.options?.length) throw new ApiError(404, "Poll not found.");
  if (post.poll.expiresAt && post.poll.expiresAt < new Date()) throw new ApiError(400, "Poll is closed.");

  post.poll.options.forEach((option) => {
    option.votes = option.votes.filter((id) => !id.equals(req.user._id));
  });

  const option =
    optionId ? post.poll.options.id(optionId) : post.poll.options[Number.isInteger(optionIndex) ? optionIndex : parseInt(optionIndex)];
  if (!option) throw new ApiError(404, "Poll option not found.");
  option.votes.addToSet(req.user._id);
  await post.save();

  return res.status(200).json(new ApiResponse(200, post.poll, "Vote recorded"));
});

module.exports = {
  getFeed,
  createPost,
  getPost,
  updatePost,
  deletePost,
  getPostsByUser,
  togglePostLike,
  addPostComment,
  togglePostCommentLike,
  deletePostComment,
  toggleSavePost,
  sharePost,
  votePoll,
};
