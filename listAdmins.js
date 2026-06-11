require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');

async function listAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const admins = await Admin.find({}).select('name email tenantId isActive createdAt');
    
    console.log(`Found ${admins.length} admins:\n`);
    admins.forEach(admin => {
      console.log('---');
      console.log('Name:', admin.name);
      console.log('Email:', admin.email);
      console.log('Tenant ID:', admin.tenantId);
      console.log('Active:', admin.isActive);
      console.log('Created:', admin.createdAt);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listAdmins();
