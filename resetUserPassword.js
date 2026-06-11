require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'aaddyly143@gmail.com'; // Correct email without dot
    const newPassword = '12345678';

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found!');
      process.exit(1);
    }

    console.log('Found user:', user.name, user.email);
    console.log('Current password hash:', user.passwordHash);

    const newHash = await bcrypt.hash(newPassword, 12);
    console.log('New password hash:', newHash);

    user.passwordHash = newHash;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    console.log('✅ Password updated successfully!');
    console.log('You can now login with:');
    console.log('Email:', email);
    console.log('Password:', newPassword);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetPassword();
