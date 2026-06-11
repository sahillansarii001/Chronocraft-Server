require('dotenv').config();
const { Resend } = require('resend');

async function test() {
  console.log('Environment Check:');
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY || 'MISSING');
  console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'MISSING');
  console.log('');

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  console.log('Sending test OTP email...');

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: 'zkhan023761@gmail.com',
      subject: 'Your Chrono Craft Password Reset OTP',
      html: `
        <!DOCTYPE html>
        <html>
        <head><title>OTP</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px;">
            <h1 style="color: #333;">Password Reset OTP</h1>
            <p>Your OTP code is:</p>
            <div style="font-size: 32px; font-weight: bold; color: #C9A84C; padding: 20px; background: #f9f9f9; text-align: center; margin: 20px 0;">
              123456
            </div>
            <p>This code is valid for 10 minutes.</p>
            <p style="color: #666; font-size: 12px; margin-top: 40px;">
              This is a test email from Chrono Craft.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log('\n✅ Email sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\nCheck zkhan023761@gmail.com inbox (and spam folder)');
  } catch (error) {
    console.error('\n❌ Failed to send email:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  }

  process.exit(0);
}

test();
