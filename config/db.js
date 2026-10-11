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
      const names = ["Error", "TypeError", "URIError", "MongooseError", "MongoParseError", "MongoServerError", "MongoServerSelectionError", "MongooseServerSelectionError", "MongoNetworkError"];
      const name = names.includes(error.name) ? error.name : "DatabaseError";
      const codes = ["ENOTFOUND", "ENODATA", "EBADNAME", "EAI_AGAIN", "ETIMEDOUT", "ECONNREFUSED", "ERR_INVALID_URL"];
      const code = typeof error.code === "number" || codes.includes(error.code) ? error.code : "unavailable";
      console.error("Database connection unavailable:", name, code);
      throw new Error("Database connection unavailable");
    });
  }
  return connectionPromise;
};
module.exports = connectDB;
