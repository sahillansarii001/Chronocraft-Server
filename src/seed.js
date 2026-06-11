'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('./models/Tenant');
const Admin = require('./models/Admin');
const User = require('./models/User');
const Product = require('./models/Product');
const Settings = require('./models/Settings');
const Category = require('./models/Category');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const watches = [
  {
    name: 'Rolex Submariner Date',
    slug: 'rolex-submariner-date',
    brand: 'Rolex',
    price: 850000,
    originalPrice: 950000,
    condition: 'New',
    stock: 2,
    images: ['https://images.unsplash.com/photo-1547996160-81dfa63595aa?q=80&w=600'],
    sku: 'ROL-001',
    movement: 'Automatic',
    caseSize: 41,
    dial: 'Black',
    caseMaterial: 'Oystersteel',
    yearOfManufacture: 2021,
    includedItems: ['Watch', 'Original Box', 'Papers'],
    tags: ['Sport', 'Dive', 'Luxury'],
    isFeatured: true,
    gender: 'Men',
  },
  {
    name: 'Omega Seamaster 300M',
    slug: 'omega-seamaster-300m',
    brand: 'Omega',
    price: 420000,
    originalPrice: 480000,
    condition: 'New',
    stock: 1,
    images: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?q=80&w=600'],
    sku: 'OMG-001',
    movement: 'Automatic',
    caseSize: 42,
    dial: 'Blue',
    caseMaterial: 'Stainless Steel',
    yearOfManufacture: 2022,
    includedItems: ['Watch', 'Box'],
    tags: ['Sport', 'Dive'],
    isFeatured: true,
    gender: 'Men',
  },
  {
    name: 'Patek Philippe Calatrava',
    slug: 'patek-philippe-calatrava',
    brand: 'Patek Philippe',
    price: 2500000,
    originalPrice: 2800000,
    condition: 'New',
    stock: 1,
    images: ['https://images.unsplash.com/photo-1619134778706-7015533a6150?q=80&w=600'],
    sku: 'PAT-001',
    movement: 'Manual',
    caseSize: 38,
    dial: 'White',
    caseMaterial: 'White Gold',
    yearOfManufacture: 2023,
    includedItems: ['Watch', 'Original Box', 'Papers', 'Warranty Card'],
    tags: ['Dress', 'Luxury'],
    isFeatured: true,
    gender: 'Men',
  },
  {
    name: 'Audemars Piguet Royal Oak',
    slug: 'ap-royal-oak',
    brand: 'Audemars Piguet',
    price: 3200000,
    condition: 'New',
    stock: 1,
    images: ['https://images.unsplash.com/photo-1622434641406-a158123450f9?q=80&w=600'],
    sku: 'AP-001',
    movement: 'Automatic',
    caseSize: 41,
    dial: 'Blue',
    caseMaterial: 'Stainless Steel',
    yearOfManufacture: 2020,
    includedItems: ['Watch', 'Box', 'Papers'],
    tags: ['Luxury', 'Sport'],
    gender: 'Men',
  },
  {
    name: 'Cartier Santos',
    slug: 'cartier-santos',
    brand: 'Cartier',
    price: 550000,
    originalPrice: 600000,
    condition: 'New',
    stock: 3,
    images: ['https://images.unsplash.com/photo-1539874754764-5a96559165b0?q=80&w=600'],
    sku: 'CAR-001',
    movement: 'Automatic',
    caseSize: 39,
    dial: 'Silver',
    caseMaterial: 'Stainless Steel',
    yearOfManufacture: 2019,
    includedItems: ['Watch'],
    tags: ['Dress', 'Classic'],
    gender: 'Unisex',
  },
  {
    name: 'IWC Portugieser',
    slug: 'iwc-portugieser',
    brand: 'IWC',
    price: 780000,
    condition: 'New',
    stock: 2,
    images: ['https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?q=80&w=600'],
    sku: 'IWC-001',
    movement: 'Automatic',
    caseSize: 42,
    dial: 'White',
    caseMaterial: 'Stainless Steel',
    yearOfManufacture: 2022,
    includedItems: ['Watch', 'Box', 'Papers'],
    tags: ['Classic', 'Chronograph'],
    gender: 'Men',
  },
  {
    name: 'Rolex Datejust 31',
    slug: 'rolex-datejust-31',
    brand: 'Rolex',
    price: 680000,
    originalPrice: 750000,
    condition: 'New',
    stock: 1,
    images: ['https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?q=80&w=600'],
    sku: 'ROL-002',
    movement: 'Automatic',
    caseSize: 31,
    dial: 'Pink/Diamond',
    caseMaterial: 'Oystersteel and Everose Gold',
    yearOfManufacture: 2022,
    includedItems: ['Watch', 'Original Box', 'Papers'],
    tags: ['Classic', 'Dress', 'Luxury'],
    isFeatured: true,
    gender: 'Women',
  },
  {
    name: 'Cartier Ballon Bleu',
    slug: 'cartier-ballon-bleu',
    brand: 'Cartier',
    price: 480000,
    originalPrice: 520000,
    condition: 'New',
    stock: 2,
    images: ['https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?q=80&w=600'],
    sku: 'CAR-002',
    movement: 'Automatic',
    caseSize: 33,
    dial: 'Silver/Guilloche',
    caseMaterial: 'Stainless Steel',
    yearOfManufacture: 2023,
    includedItems: ['Watch', 'Box', 'Papers'],
    tags: ['Dress', 'Classic', 'Elegant'],
    gender: 'Women',
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'Chronocraft.rk@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Chrono Craft Admin';
  const customerEmail = process.env.CUSTOMER_EMAIL || 'customer@chronosvault.com';
  const customerPassword = process.env.CUSTOMER_PASSWORD || 'Customer@123';

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(uri);
    console.log('Connected. Purging existing collections...');

    await Tenant.deleteMany({});
    await Admin.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});
    await Settings.deleteMany({});
    await Category.deleteMany({});

    console.log('Collections cleared. Seeding default tenant...');

    // 1. Seed Tenant
    const tenant = await Tenant.create({
      _id: '6a1e8ec2a16ad059eb1c64ae',
      subdomain: 'localhost',
      businessName: 'Chrono Craft',
      email: adminEmail,
      plan: 'enterprise',
      status: 'active',
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    });

    console.log(`Tenant created: ${tenant.businessName} (ID: ${tenant._id})`);

    // 2. Seed Settings
    const settings = await Settings.create({
      tenantId: tenant._id,
      whatsappNumber: '918850852021',
      whatsappTemplates: {
        orderConfirmation: 'Dear {{name}}, your order {{orderNumber}} for {{total}} has been confirmed!',
        statusUpdate: 'Dear {{name}}, your order {{orderNumber}} is now {{status}}.',
        enquiryReply: 'Hello, thank you for enquiring about {{productName}}. How can we assist you?',
        cartAbandonment: 'Hi {{name}}, we noticed you left some luxury timepieces in your cart. Check out now!',
      },
      theme: {
        primaryColor: '#C9A84C',
      },
      seo: {
        title: 'Chrono Craft Local — Premium Luxury Watches',
        description: 'Discover authenticated brand-new luxury watches from Rolex, Omega, Patek Philippe, and more.',
      },
    });
    console.log(`Default settings created for tenant.`);

    // 3. Seed Admin
    const adminPassHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const admin = await Admin.create({
      tenantId: tenant._id,
      name: adminName,
      email: adminEmail,
      passwordHash: adminPassHash,
      role: 'admin',
      isActive: true,
    });
    console.log(`Admin created: ${admin.email}`);

    // 4. Seed Customer
    const customerPassHash = await bcrypt.hash(customerPassword, SALT_ROUNDS);
    const customer = await User.create({
      tenantId: tenant._id,
      name: 'John Doe',
      email: customerEmail,
      passwordHash: customerPassHash,
      phone: '9999999999',
    });
    console.log(`Customer created: ${customer.email}`);

    // 5. Seed Category
    const category = await Category.create({
      tenantId: tenant._id,
      name: 'Luxury Watches',
      slug: 'luxury-watches',
      description: 'Brand new luxury timepieces',
    });
    console.log(`Category created: ${category.name}`);

    // 6. Seed Products
    const productsData = watches.map((w) => ({
      ...w,
      tenantId: tenant._id,
      category: category._id,
    }));
    const products = await Product.insertMany(productsData);
    console.log(`Seeded ${products.length} watch listings.`);

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

seed();
