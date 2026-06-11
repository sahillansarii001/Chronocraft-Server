'use strict';

const mongoose = require('mongoose');

/**
 * Connects to MongoDB Atlas using the MONGODB_URI environment variable.
 * Exits the process with code 1 if the URI is missing or if the connection fails.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[DB] FATAL: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10s timeout for initial connection
    });

    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected. Mongoose will attempt to reconnect.');
    });
  } catch (err) {
    console.error(`[DB] Failed to connect to MongoDB Atlas: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
