require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const users = await User.find({}).select('name email tenantId createdAt');
    
    console.log(`Found ${users.length} users:\n`);
    users.forEach(user => {
      console.log('---');
      console.log('Name:', user.name);
      console.log('Email:', user.email);
      console.log('Tenant ID:', user.tenantId);
      console.log('Created:', user.createdAt);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listUsers();
