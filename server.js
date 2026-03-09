const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '.')));

// Initialize SQLite Database
const dbPath = path.join(__dirname, 'astromathaino.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database error:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Students table
    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // OTPs table
    db.run(`
      CREATE TABLE IF NOT EXISTS otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        otp TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INTEGER DEFAULT 0,
        verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables initialized');
  });
}

// Helper functions
function generateOTP() {
  return Math.floor(Math.random() * 900000) + 100000;
}

function getExpiryTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 10);
  return now.toISOString();
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Email configuration (optional)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// ===== API Routes =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: '✅ Server running', timestamp: new Date().toISOString() });
});

// Send OTP
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Check if email already exists
    const existingStudent = await dbGet('SELECT id FROM students WHERE email = ?', [email]);
    if (existingStudent) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiryTime = getExpiryTime();

    try {
      await dbRun(
        `INSERT INTO otps (email, otp, expires_at, attempts, verified)
         VALUES (?, ?, ?, 0, 0)`,
        [email, otp.toString(), expiryTime]
      );
    } catch (err) {
      // Update if exists
      await dbRun(
        `UPDATE otps SET otp = ?, expires_at = ?, attempts = 0, verified = 0
         WHERE email = ?`,
        [otp.toString(), expiryTime, email]
      );
    }

    // Try to send email (optional)
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your AstroMathaino OTP Code',
        html: `
          <h2>Welcome to AstroMathaino</h2>
          <p>Your OTP code is:</p>
          <h1 style="color: #6366f1; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
        `
      });
      console.log(`✅ OTP sent to ${email}`);
    } catch (emailErr) {
      console.log(`⚠️ Email not configured, but OTP generated: ${otp}`);
    }

    res.json({ 
      success: true, 
      message: 'OTP generated',
      otp: process.env.NODE_ENV === 'development' ? otp.toString() : undefined,
      expiresIn: '10 minutes'
    });

  } catch (error) {
    console.error('❌ Error generating OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to generate OTP' });
  }
});

// Register student
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, otp } = req.body;

    if (!email || !password || !name || !otp) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }

    // Get OTP record
    const otpRecord = await dbGet('SELECT * FROM otps WHERE email = ?', [email]);

    if (!otpRecord) {
      return res.status(400).json({ success: false, error: 'OTP not found' });
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await dbRun('DELETE FROM otps WHERE email = ?', [email]);
      return res.status(400).json({ success: false, error: 'OTP expired' });
    }

    // Verify OTP
    if (otpRecord.otp !== otp.toString()) {
      await dbRun('UPDATE otps SET attempts = attempts + 1 WHERE email = ?', [email]);
      
      const updatedRecord = await dbGet('SELECT attempts FROM otps WHERE email = ?', [email]);
      if (updatedRecord.attempts >= 3) {
        await dbRun('DELETE FROM otps WHERE email = ?', [email]);
        return res.status(400).json({ success: false, error: 'Maximum attempts exceeded' });
      }
      
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

    // Check if student exists
    const existingStudent = await dbGet('SELECT id FROM students WHERE email = ?', [email]);
    if (existingStudent) {
      return res.status(400).json({ success: false, error: 'Student already registered' });
    }

    // Register student
    try {
      await dbRun(
        `INSERT INTO students (name, email, password)
         VALUES (?, ?, ?)`,
        [name, email, password]
      );
    } catch (err) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Delete OTP
    await dbRun('DELETE FROM otps WHERE email = ?', [email]);

    res.json({ 
      success: true, 
      message: 'Student registered successfully',
      student: { email, name }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// Student login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const student = await dbGet(
      'SELECT * FROM students WHERE email = ? AND password = ?',
      [email, password]
    );

    if (!student) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    res.json({ 
      success: true, 
      message: 'Login successful',
      student: {
        id: student.id,
        email: student.email,
        name: student.name
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Admin login
app.post('/api/admin-login', (req, res) => {
  try {
    const { email, password } = req.body;

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'anuragdas1102@gmail.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AD777';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      res.json({ 
        success: true, 
        message: 'Admin login successful',
        admin: { email, name: 'Anurag Das' }
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }

  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ success: false, error: 'Admin login failed' });
  }
});

// Save contact message
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }

    await dbRun(
      `INSERT INTO messages (name, email, subject, message)
       VALUES (?, ?, ?, ?)`,
      [name, email, subject, message]
    );

    res.json({ success: true, message: 'Message saved successfully' });

  } catch (error) {
    console.error('❌ Contact error:', error);
    res.status(500).json({ success: false, error: 'Failed to save message' });
  }
});

// Get all messages (admin only)
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM messages ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ success: true, messages });

  } catch (error) {
    console.error('❌ Messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║  🚀 AstroMathaino Backend Server   ║
║  Server running on port ${PORT}      ║
║  http://localhost:${PORT}           ║
╚════════════════════════════════════╝
  `);
});

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});