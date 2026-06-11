require('dotenv').config();

async function testOTP() {
  console.log('Testing OTP email sending...\n');
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET ✓' : 'MISSING ✗');
  console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'MISSING ✗');
  console.log('');

  // Import AFTER dotenv is configured
  let mailer;
  try {
    mailer = require('./src/utils/mailer');
    console.log('Mailer module loaded successfully');
    console.log('Available functions:', Object.keys(mailer));
  } catch (err) {
    console.error('❌ Failed to load mailer module:');
    console.error('Error:', err.message);
    console.error('\nThis usually means:');
    console.error('1. Missing environment variables (RESEND_API_KEY or RESEND_FROM_EMAIL)');
    console.error('2. Syntax error in mailer.js');
    console.error('3. Missing resend package (run: npm install resend)');
    process.exit(1);
  }

  if (!mailer.sendOtpEmail) {
    console.error('❌ sendOtpEmail function not found in mailer module');
    console.error('Available:', Object.keys(mailer));
    process.exit(1);
  }

  try {
    const testOtp = '123456';
    const testEmail = 'zkhan023761@gmail.com'; // Your test email

    console.log(`\nSending OTP ${testOtp} to ${testEmail}...`);

    const result = await mailer.sendOtpEmail({
      to: testEmail,
      name: 'Test User',
      otp: testOtp
    });

    console.log('\n✅ OTP email sent successfully!');
    console.log('Result:', result);
    console.log('\nCheck your email inbox (and spam folder)');
    console.log('OTP Code:', testOtp);

  } catch (error) {
    console.error('\n❌ Failed to send OTP email:');
    console.error('Error:', error.message);
    if (error.message.includes('API key')) {
      console.error('\n→ Your Resend API key appears to be invalid');
      console.error('→ Check that RESEND_API_KEY in .env matches your key from resend.com');
    } else if (error.message.includes('domain') || error.message.includes('verified')) {
      console.error('\n→ Sender email domain not verified');
      console.error('→ Update RESEND_FROM_EMAIL to: onboarding@resend.dev');
      console.error('→ Or verify your domain at: resend.com/domains');
    }
  }

  process.exit(0);
}

testOTP();
