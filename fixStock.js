/**
 * One-time fix: set stock = 1 for all products that have stock = 0
 * Run with: node fixStock.js
 */
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Product  = require('./src/models/Product');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const result = await Product.updateMany(
    { stock: 0 },
    { $set: { stock: 1 } }
  );

  console.log(`Updated ${result.modifiedCount} products: stock 0 → 1`);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
