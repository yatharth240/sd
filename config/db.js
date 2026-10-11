const mongoose = require("mongoose");
const config = require("./environment");
let connectionPromise;
const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(config.mongoUri, {
      dbName: config.mongoDbName,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 5,
    }).catch((error) => {
      connectionPromise = undefined;
      // Connection errors can contain credentials or infrastructure details.
      const name = /^[A-Za-z]{0,48}Error$/.test(error.name) ? error.name : "DatabaseError";
      const codes = ["ENOTFOUND", "ENODATA", "EBADNAME", "EAI_AGAIN", "ETIMEDOUT", "ECONNREFUSED", "ERR_INVALID_URL"];
      const code = typeof error.code === "number" || codes.includes(error.code) ? error.code : "unavailable";
      const message = String(error.message || "");
      const category = /auth|password|credential/i.test(message) ? "authentication"
        : /querySrv|queryTxt|getaddrinfo|ENOTFOUND|EBADNAME/i.test(message) ? "DNS"
        : /URI|URL|scheme|connection string|unescaped/i.test(message) ? "connection string format"
        : /TLS|SSL|certificate|server selection|timed out/i.test(message) ? "network connection"
        : "connection failure";
      console.error("Database connection unavailable:", name, code, category);
      throw new Error("Database connection unavailable");
    });
  }
  return connectionPromise;
};
module.exports = connectDB;
