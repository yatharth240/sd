const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server-core");
const mongoose = require("mongoose");
const passport = require("passport");
let database, app, User, Post, Comment, profile;

before(async () => {
  let mongoUri;
  if (process.env.TEST_MONGODB_URI) {
    const testUrl = new URL(process.env.TEST_MONGODB_URI);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(testUrl.hostname)) {
      throw new Error("TEST_MONGODB_URI must reference a local test-only database");
    }
    mongoUri = process.env.TEST_MONGODB_URI;
  } else {
    database = await MongoMemoryServer.create();
    mongoUri = database.getUri();
  }
  Object.assign(process.env, {
    NODE_ENV: "production",
    APP_BASE_URL: "https://learnflow.example",
    MONGODB_URI: mongoUri,
    MONGODB_DB_NAME: "learnflow_verification_" + require("node:crypto").randomUUID().replaceAll("-", ""),
    SESSION_SECRET: "temporary-test-secret-never-use-in-production",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
  });
  app = require("../app");
  await require("../config/db")();
  User = mongoose.model("users");
  Post = mongoose.model("posts");
  Comment = mongoose.model("comments");
  const google = passport._strategy("google");
  // Replace only the external Google exchange; exercise real OAuth state,
  // callback handling, user lookup, session storage, and deserialization.
  google._oauth2.getOAuthAccessToken = (code, params, done) => done(null, "test-access", "test-refresh", {});
  google.userProfile = (accessToken, done) => done(null, profile);
});

after(async () => {
  if (mongoose.connection.readyState === 1 && process.env.MONGODB_DB_NAME.startsWith("learnflow_verification_")) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  await database?.stop();
});

function get(url, cookie) {
  const req = request(app).get(url).set("X-Forwarded-Proto", "https");
  if (cookie) req.set("Cookie", cookie);
  return req;
}
function write(method, url, body, cookie) {
  return request(app)[method](url).set("X-Forwarded-Proto", "https")
    .set("Origin", process.env.APP_BASE_URL).set("Cookie", cookie).send(body);
}
async function login(id, role) {
  profile = { id, displayName: "Verification User", name: { givenName: "Verification", familyName: "User" },
    emails: [{ value: id + "@example.com" }], photos: [{ value: "https://example.com/avatar.png" }] };
  if (role !== undefined) await User.create({ googleID: id, firstName: "Verification", displayName: "Verification User", email: id + "@example.com", role, image: "https://example.com/avatar.png" });
  const start = await get("/auth/google").expect(302);
  const state = new URL(start.headers.location).searchParams.get("state");
  assert.ok(state, "OAuth request includes CSRF state");
  assert.equal(new URL(start.headers.location).searchParams.get("redirect_uri"), "https://learnflow.example/auth/google/callback");
  const cookie = start.headers["set-cookie"][0].split(";")[0];
  const response = await get("/auth/google/callback?code=test-code&state=" + state, cookie).expect(302);
  assert.match(response.headers["set-cookie"][0], /HttpOnly/);
  assert.match(response.headers["set-cookie"][0], /Secure/);
  assert.match(response.headers["set-cookie"][0], /SameSite=Lax/);
  assert.equal(response.headers.location, role === undefined ? "/signup" : "/dashboard");
  return response.headers["set-cookie"][0].split(";")[0];
}

test("homepage, assets, health, and guest access", async () => {
  const home = await get("/").expect(200);
  assert.match(home.text, /LearnFlow/);
  assert.match(home.text, /Sign in with Google/);
  assert.equal(home.headers["set-cookie"], undefined);
  await get("/cstm-assets/logo.svg").expect(200);
  await get("/css/purpose.css").expect(200);
  await get("/healthz").expect(200, { status: "ok" });
  await get("/dashboard").expect(302).expect("Location", "/");
  await get("/get/preSignedURL?fileName=avatar.png&contentType=image/png").expect(302).expect("Location", "/");
  await get("/missing-page").expect(404);
});

test("OAuth state rejects an invalid callback", async () => {
  const start = await get("/auth/google").expect(302);
  const cookie = start.headers["set-cookie"][0].split(";")[0];
  await get("/auth/google/callback?code=test-code&state=invalid", cookie).expect(302).expect("Location", "/");
});

test("new user signup, roles, profile restrictions, and logout", async () => {
  const cookie = await login("new-user");
  await get("/signup", cookie).expect(200);
  await write("patch", "/user/update/role", { role: 9 }, cookie).expect(400);
  await write("patch", "/user/update/role", { role: 1 }, cookie).expect(200);
  await get("/dashboard", cookie).expect(200);
  await get("/create/post", cookie).expect(302).expect("Location", "/dashboard");
  await write("patch", "/profile", { displayName: "Updated Name", role: 0, googleID: "changed-id", email: "changed@example.com" }, cookie).expect(200);
  const saved = await User.findOne({ googleID: "new-user" });
  assert.equal(saved.role, 1);
  assert.equal(saved.email, "new-user@example.com");
  assert.equal(saved.displayName, "Updated Name");
  await get("/profile", cookie).expect(200);
  await get("/auth/logout", cookie).expect(302).expect("Location", "/");
  await get("/dashboard", cookie).expect(302).expect("Location", "/");
});

test("returning creator, content, comments, and configured upload URLs", async () => {
  const cookie = await login("creator", 0);
  await get("/create/post", cookie).expect(200);
  const created = await write("post", "/create/post", { title: "Verification article", subTitle: "Test content", description: "<p>Hello</p><script>alert(1)</script>", userID: "forged" }, cookie).expect(200);
  assert.equal(created.body.description, "<p>Hello</p>");
  assert.notEqual(created.body.userID, "forged");
  await get("/post/" + created.body._id, cookie).expect(200);
  const comment = await write("post", "/create/comment", { postID: created.body._id, commentText: "Verification comment" }, cookie).expect(200);
  await write("post", "/create/comment", { postID: created.body._id, commentText: "Verification reply", parentID: comment.body._id, depth: 2 }, cookie).expect(200);
  const replies = await get("/fetch/reply?parentID=" + comment.body._id + "&parentDepth=1", cookie).expect(200);
  assert.equal(replies.body.length, 1);
  assert.equal(replies.body[0].commentText, "Verification reply");
  const sessionCount = await mongoose.connection.db.collection("sessions").countDocuments();
  assert.ok(sessionCount > 0, "sessions persist in MongoDB");
  await get("/get/preSignedURL?fileName=avatar.svg&contentType=image/svg+xml", cookie).expect(400);
  await get("/get/preSignedURL?fileName=avatar.png&contentType=image/png", cookie).expect(503);
  Object.assign(process.env, { AWS_REGION: "ap-south-1", AWS_ACCESS_KEY_ID: "test-key", AWS_SECRET_ACCESS_KEY: "test-secret", S3_BUCKET: "verification-bucket", S3_PUBLIC_BASE_URL: "https://images.example.com" });
  const upload = await get("/get/preSignedURL?fileName=avatar.png&contentType=image/png", cookie).expect(200);
  assert.match(upload.body.url, /X-Amz-Expires=300/);
  assert.match(upload.body.publicUrl, /^https:\/\/images\.example\.com\/.+\.png$/);
  assert.equal(upload.headers["cache-control"], "no-store");
  const crossOrigin = await request(app).patch("/profile").set("X-Forwarded-Proto", "https").set("Cookie", cookie).set("Origin", "https://other.example").send({ displayName: "Bad origin" }).expect(403);
  assert.equal(crossOrigin.body.error, "Invalid request origin");
  assert.ok(await Post.findById(created.body._id));
  assert.equal(await Comment.countDocuments({ postID: created.body._id }), 2);
});
