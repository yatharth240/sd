const path = require("node:path");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const passport = require("passport");
const config = require("./config/environment");
const connectDB = require("./config/db");
require("./models/User");
require("./models/Post");
require("./models/Comment");
require("./config/passport");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "1mb" }));
app.get("/healthz", async (req, res) => {
  try {
    await connectDB();
    res.status(200).json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
// Await the shared connection before sessions or routes use MongoDB.
app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch { res.status(503).render("error-500"); }
});
let sessionMiddleware;
app.use((req, res, next) => {
  if (!sessionMiddleware) {
    const store = MongoStore.create({
      clientPromise: Promise.resolve(mongoose.connection.getClient()),
      dbName: config.mongoDbName,
      collectionName: "sessions",
      autoRemove: "native",
    });
    store.on("error", () => console.error("Session store unavailable"));
    sessionMiddleware = session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        secure: config.production,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    });
  }
  sessionMiddleware(req, res, next);
});
app.use(passport.initialize());
app.use(passport.session());
// Browser writes must originate from this application.
app.use((req, res, next) => {
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && origin !== config.baseUrl) {
      return res.status(403).json({ error: "Invalid request origin" });
    }
  }
  next();
});
app.use("/auth", require("./routes/auth"));
app.use("/", require("./routes/index"));
app.use("/", require("./routes/profile"));
app.use("/", require("./routes/post"));
app.use("/", require("./routes/comment"));
app.use("/", require("./routes/upload"));
app.use((req, res) => res.status(404).render("error-404"));
app.use((error, req, res, next) => {
  console.error("Request failed:", error.name);
  if (res.headersSent) return next(error);
  if (req.accepts("html")) return res.status(500).render("error-500");
  res.status(500).json({ error: "Something went wrong" });
});
// Export for Vercel; use PORT when started as a regular Node service.
module.exports = app;
if (require.main === module) {
  connectDB().then(() => {
    const port = Number(process.env.PORT || 3000);
    app.listen(port, "0.0.0.0", () => console.log("LearnFlow listening on port " + port));
  }).catch(() => {
    console.error("Database connection failed. Check the private runtime configuration.");
    process.exit(1);
  });
}
