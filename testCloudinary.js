require('dotenv').config({ path: 'C:/Users/ADMIN/Chornocraft/Server/.env' });
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

cloudinary.api.ping()
  .then(res => console.log('Ping success:', res))
  .catch(err => console.error('Ping failed:', err));
