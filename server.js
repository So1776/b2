// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
// importing axios library to call data from API
const axios = require("axios");
require("dotenv").config();


const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- Database setup ---
const dbPath = path.join(__dirname, "database.sqlite");
console.log("DB PATH =>", dbPath);
const db = new sqlite3.Database(dbPath);

// Create users table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// adds resume table ONLY if it is missing
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      upload_path TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error("Error creating resumes table:", err.message);
    } else {
      console.log("Resumes table created/verified");
    }
  });

  // Create index for faster lookups
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_resumes_user_id 
    ON resumes(user_id);
  `, (err) => {
    if (err) {
      console.error("Error creating resumes index:", err.message);
    } else {
      console.log("Resumes index created/verified");
    }
  });
});

const uploadDir = path.join(__dirname, "uploads/resumes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("✅ Created uploads directory");
} 

// --- Multer config (storage + file type + size limit) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/resumes"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const userId = req.user.user_id; // IMPORTANT: matches JWT payload below
    cb(null, `user${userId}_${Date.now()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only PDF, DOC, or DOCX files are allowed"));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// --- Routes ---
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// SIGNUP: creates a user account
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
      [name, email, password_hash],
      function (err) {
        if (err) {
          return res.status(400).json({ error: "Email already in use" });
        }
        return res.status(201).json({ message: "User created", user_id: this.lastID });
      }
    );
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

// LOGIN: verifies user + returns a token
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_later";
    const token = jwt.sign({ user_id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "2h" });

    return res.json({ message: "Logged in", token });
  });
});

// Simple auth check middleware (protect routes)
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_later";
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // decoded.user_id exists
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// LOCKED ROUTE: proves login is working
app.get("/me", requireAuth, (req, res) => {
  res.json({ message: "You are logged in", user: req.user });
});

// Fetch the logged-in user's resume metadata
app.get("/resume", requireAuth, (req, res) => {
  const userId = req.user.user_id; // matches your JWT payload

  db.get(
    `SELECT id, user_id, original_filename, stored_filename, mime_type, size, upload_path, uploaded_at
     FROM resumes
     WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!row) return res.status(404).json({ error: "No resume found" });
      return res.json({ resume: row });
    }
  );
});

// Simple protected resume upload route
app.post("/resume/upload", requireAuth, upload.single("resume"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const userId = req.user.user_id;

  db.run(
    `INSERT INTO resumes (user_id, original_filename, stored_filename, mime_type, size, upload_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      req.file.originalname,
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      req.file.path,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });

      res.status(201).json({
        message: "Resume uploaded",
        resume_id: this.lastID,
        user_id: userId,
      });
    }
  );
});

// Simple error handler for upload/type/size errors
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || "Upload error" });
});

// calling internship data from serpapi
app.get("/api/internships", async (req, res) => { 
  const query = req.query.q || "software engineering internship";

  try {
    const response = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google_jobs",
        q: query,
        location: "United States",
        api_key: process.env.SERPAPI_KEY
      }
    });

    res.json(response.data.jobs_results);
  } catch (err) {
    console.error("SerpApi error:", err.message);
    res.status(500).json({ error: "Failed to fetch internships" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 