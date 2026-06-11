require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./src/models/Admin');

async function resetAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'chronocraft.rk@gmail.com';
    const newPassword = 'Rehu@1826'; // From your .env file

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      console.log('Admin not found!');
      process.exit(1);
    }

    console.log('Found admin:', admin.name, admin.email);
    console.log('Current password hash:', admin.passwordHash);

    const newHash = await bcrypt.hash(newPassword, 12);
    console.log('New password hash:', newHash);

    admin.passwordHash = newHash;
    admin.loginAttempts = 0;
    admin.lockUntil = undefined;
    await admin.save();

    console.log('\n✅ Admin password updated successfully!');
    console.log('\n=================================');
    console.log('ADMIN LOGIN CREDENTIALS');
    console.log('=================================');
    console.log('Email:', email);
    console.log('Password:', newPassword);
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetAdminPassword();
