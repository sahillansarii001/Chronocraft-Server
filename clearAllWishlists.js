require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function clearAllWishlists() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const users = await User.find({});
    
    console.log('Clearing wishlists for all users...\n');
    
    for (const user of users) {
      const wishlistCount = user.wishlist.length;
      user.wishlist = [];
      await user.save();
      console.log(`✅ Cleared wishlist for ${user.email} (${wishlistCount} items removed)`);
    }

    console.log('\n=================================');
    console.log('✅ All wishlists cleared!');
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

clearAllWishlists();
