const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
function check(overrides) {
  return spawnSync(process.execPath, ["-e", 'const config = require("./config/environment"); console.log(JSON.stringify({callback:config.googleCallbackUrl,db:config.mongoDbName}))'], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_BASE_URL: "https://learnflow.example",
      SESSION_SECRET: "verification-only-session-secret-long-enough",
      MONGODB_URI: "mongodb://127.0.0.1/learnFlow",
      MONGODB_DB_NAME: "",
      GOOGLE_CLIENT_ID: "verification-client",
      GOOGLE_CLIENT_SECRET: "verification-secret",
      ...overrides,
    },
    encoding: "utf8",
    windowsHide: true,
  });
}
test("production configuration retains the database and canonical OAuth callback", () => {
  const result = check({ APP_BASE_URL: "https://learnflow.example/" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { callback: "https://learnflow.example/auth/google/callback", db: "learnFlow" });
});
test("production rejects missing secrets without displaying their values", () => {
  const result = check({ GOOGLE_CLIENT_SECRET: "" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing environment variable: GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(result.stderr, /verification-only-session-secret-long-enough/);
});
test("production rejects insecure or path-based application origins", () => {
  for (const origin of ["http://learnflow.example", "https://learnflow.example/nested"]) {
    const result = check({ APP_BASE_URL: origin });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /APP_BASE_URL must/);
  }
});
