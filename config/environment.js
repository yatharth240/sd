const production = process.env.NODE_ENV === "production";
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}
const sessionSecret = required("SESSION_SECRET");
if (sessionSecret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
const baseUrl = (process.env.APP_BASE_URL || (production ? required("APP_BASE_URL") : "http://localhost:3000")).replace(/\/$/, "");
const parsedBaseUrl = new URL(baseUrl);
if (production && parsedBaseUrl.protocol !== "https:") throw new Error("APP_BASE_URL must use HTTPS in production");
if (parsedBaseUrl.origin !== baseUrl) throw new Error("APP_BASE_URL must contain only the site origin");
module.exports = {
  production,
  sessionSecret,
  baseUrl,
  mongoUri: required("MONGODB_URI"),
  mongoDbName: process.env.MONGODB_DB_NAME || "learnFlow",
  googleClientId: required("GOOGLE_CLIENT_ID"),
  googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
  googleCallbackUrl: baseUrl + "/auth/google/callback",
};
