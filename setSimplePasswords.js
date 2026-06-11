require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./src/models/Admin');
const User = require('./src/models/User');

async function setSimplePasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const simplePassword = 'admin123'; // Easy to remember

    // Update admin password
    const admin = await Admin.findOne({ email: 'chronocraft.rk@gmail.com' });
    if (admin) {
      admin.passwordHash = await bcrypt.hash(simplePassword, 12);
      admin.loginAttempts = 0;
      admin.lockUntil = undefined;
      await admin.save();
      console.log('✅ Admin password updated');
    }

    // Update all user passwords
    const users = await User.find({});
    for (const user of users) {
      user.passwordHash = await bcrypt.hash(simplePassword, 12);
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
      console.log(`✅ User password updated: ${user.email}`);
    }

    console.log('\n=================================');
    console.log('ALL ACCOUNTS - SIMPLE PASSWORD');
    console.log('=================================');
    console.log('Password for ALL accounts:', simplePassword);
    console.log('\nADMIN:');
    console.log('  Email: chronocraft.rk@gmail.com');
    console.log('  Password:', simplePassword);
    console.log('\nUSERS:');
    users.forEach(user => {
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${simplePassword}`);
    });
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

setSimplePasswords();
