const User    = require('../models/User');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'looped_secret_2024';

// ── OTP email sender ──────────────────────────────────────────
// Uses Brevo (free, 300 emails/day, any recipient, no domain needed)
// Falls back to console log if no API key set
async function sendOtpEmail(email, otp) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY

  if (!BREVO_API_KEY || BREVO_API_KEY === 'your_brevo_api_key_here') {
    console.log(`\n${'─'.repeat(40)}`)
    console.log(`📧  OTP for ${email}`)
    console.log(`    Code: ${otp}`)
    console.log(`${'─'.repeat(40)}\n`)
    return { success: true, mode: 'console' }
  }

  const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@looped.app'
  const SENDER_NAME  = process.env.BREVO_SENDER_NAME  || 'Looped'

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({
        sender:   { name: SENDER_NAME, email: SENDER_EMAIL },
        to:       [{ email }],
        subject:  'Your Looped verification code',
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h1 style="color: #ec4899; font-size: 28px; margin-bottom: 8px;">L&#8734;ped</h1>
            <p style="color: #555; font-size: 15px; margin-bottom: 24px;">
              Here is your verification code:
            </p>
            <div style="background: #fdf2f8; border: 2px solid #fce7f3;
                        border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <p style="font-size: 48px; font-weight: bold; letter-spacing: 12px;
                         color: #ec4899; margin: 0;">${otp}</p>
            </div>
            <p style="color: #888; font-size: 13px;">
              Expires in 10 minutes. If you did not request this, ignore this email.
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Brevo error:', err?.message || res.status)
      // Fall back to console
      console.log(`\n📧 OTP for ${email}: ${otp}\n`)
      return { success: true, mode: 'console_fallback' }
    }

    return { success: true, mode: 'email' }
  } catch (err) {
    console.error('Email failed:', err.message)
    console.log(`\n📧 OTP for ${email}: ${otp}\n`)
    return { success: true, mode: 'console_fallback' }
  }
}

// ── Generate 6-digit OTP ──────────────────────────────────────
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /auth/signup
exports.signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email });
    if (existing && existing.isVerified) {
      return res.status(400).json({ message: 'Email already registered. Please log in.' });
    }

    const hashed   = await bcrypt.hash(password, 10);
    const otp      = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Update if unverified account exists, else create new
    let user;
    if (existing && !existing.isVerified) {
      existing.password  = hashed;
      existing.name      = name || existing.name;
      existing.otp       = otp;
      existing.otpExpiry = otpExpiry;
      user = await existing.save();
    } else {
      user = await User.create({
        email, password: hashed,
        name: name || email.split('@')[0],
        otp, otpExpiry, isVerified: false,
      });
    }

    const { success, mode } = await sendOtpEmail(email, otp);

    const message = mode === 'email'
      ? 'Verification code sent to your email'
      : `Verification code sent (check server console — dev mode)`;

    res.json({ message, userId: user._id, devMode: mode !== 'email' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const user = await User.findById(userId);
    if (!user)             return res.status(404).json({ message: 'User not found' });
    if (user.otp !== otp)  return res.status(400).json({ message: 'Incorrect code. Please try again.' });
    if (new Date() > user.otpExpiry) return res.status(400).json({ message: 'Code expired. Please sign up again.' });

    user.isVerified = true;
    user.otp        = null;
    user.otpExpiry  = null;
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'No account found with this email' });
    if (!user.isVerified) return res.status(400).json({ message: 'Please verify your email first' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Incorrect password' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /auth/resend-otp
exports.resendOtp = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'Already verified' });

    const otp       = generateOtp();
    user.otp        = otp;
    user.otpExpiry  = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(user.email, otp);
    res.json({ message: 'New code sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
