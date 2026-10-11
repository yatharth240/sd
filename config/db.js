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
    }).catch(() => {
      connectionPromise = undefined;
      // Connection errors can contain credentials or infrastructure details.
      throw new Error("Database connection unavailable");
    });
  }
  return connectionPromise;
};
module.exports = connectDB;
