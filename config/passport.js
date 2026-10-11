const passport = require("passport");
const mongoose = require("mongoose");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const config = require("./environment");
const User = mongoose.model("users");
passport.use(new GoogleStrategy({
  clientID: config.googleClientId,
  clientSecret: config.googleClientSecret,
  callbackURL: config.googleCallbackUrl,
  state: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleID: profile.id });
    if (!user) {
      user = await User.create({
        googleID: profile.id,
        firstName: profile.name?.givenName || profile.displayName || "User",
        lastName: profile.name?.familyName || "",
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        image: profile.photos?.[0]?.value,
      });
    }
    done(null, user);
  } catch (error) { done(error); }
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try { done(null, await User.findById(id)); }
  catch (error) { done(error); }
});
