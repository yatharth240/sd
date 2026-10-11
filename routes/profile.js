const express = require("express");

const { ensureAuth } = require("../middleware/auth");
const { ensureSignUp } = require("../middleware/user");

const router = express.Router();

router.get("/profile", ensureAuth, ensureSignUp, (req, res) => {
  res.render("profile-settings.ejs");
});

router.patch("/profile", ensureAuth, ensureSignUp, async (req, res) => {
  try {
    const profileData = req.body;
    const user = req.user;

    const editableFields = ["displayName", "firstName", "lastName", "phone", "gender", "about", "birthdate", "image", "cover"];
    for (const key of editableFields) {
      if (Object.hasOwn(profileData, key)) {
        if (typeof profileData[key] !== "string") return res.status(400).json({ error: "Invalid profile field" });
        if (["image", "cover"].includes(key) && !/^https:\/\//.test(profileData[key])) {
          return res.status(400).json({ error: "Image URL must use HTTPS" });
        }
        user[key] = profileData[key];
      }
    }

    await user.save();

    res.status(200).send(user);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Something went wrong",
    });
  }
});

module.exports = router;
