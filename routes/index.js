const express = require("express");
const passport = require("passport");

const { ensureAuth, ensureGuest } = require("../middleware/auth");
const { ensureNewUser, ensureSignUp } = require("../middleware/user");
const { fetchAllPosts } = require("../middleware/post");

const router = express.Router();

router.get("/", ensureGuest, (req, res) => {
  res.render("login");
});

router.get("/signup", ensureAuth, ensureNewUser, (req, res) => {
  res.render("signup-profile");
});

router.patch(
  "/user/update/role",
  ensureAuth,
  ensureNewUser,
  async (req, res) => {
    try {
      const user = req.user;
      const role = Number(req.body.role);
      if (req.body.role === undefined || req.body.role === null || ![0, 1].includes(role)) {
        return res.status(400).json({ error: "Choose a creator or student role" });
      }
      user.role = role;
      await user.save();
      res.status(200).send({});
    } catch (error) {
      console.log(error);
      res.status(500).send({
        error: "Something went wrong",
      });
    }
  }
);

router.get(
  "/dashboard",
  ensureAuth,
  ensureSignUp,
  fetchAllPosts,
  (req, res) => {
    res.render("dashboard");
  }
);

module.exports = router;
