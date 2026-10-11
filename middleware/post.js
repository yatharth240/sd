const mongoose = require("mongoose");

const Post = mongoose.model("posts");

const fetchAllPosts = async (req, res, next) => {
  try {
    res.locals.posts = await Post.find({});
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  fetchAllPosts,
};
