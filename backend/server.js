// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// For parsing PDF and Word resumes (if you want to extract text later), Author: Caleb Perez, 04/30/26
const pdfParse = require("pdf-parse");
const mammoth  = require("mammoth");

// importing axios library to call data from API
const axios = require("axios");
require("dotenv").config();


const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));
app.use("/uploads/profile_pics", express.static(path.join(__dirname, "uploads/profile_pics")));

app.use('/resume/skills', (req, res, next) => next());

// API Endpoints
app.get("/api/jobs", async (req, res) => { 
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

    const raw = response.data.jobs_results || [];

    const formatted = raw.map(job => ({
      job_id:      job.job_id   || null,
      title:       job.title    || "Untitled Role",
      company_name: job.company_name || "Unknown Company",
      location:    job.location || "Location not listed",
      description: formatDescription(job.description || ""),
      detected_extensions: {
        schedule_type:   job.detected_extensions?.schedule_type  || null,
        salary:          job.detected_extensions?.salary         || null,
        work_from_home:  job.detected_extensions?.work_from_home || false,
        posted_at:       job.detected_extensions?.posted_at      || null,
      },
      job_highlights: job.job_highlights || [],
      apply_options:  job.apply_options  || [],
      share_link:     job.share_link     || null,
    }));

    res.json(formatted);

  } catch (err) {
    console.error("SerpApi error:", err.message);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

function formatDescription(raw) {
  return raw
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/\.([A-Z])/g, ".\n\n$1")
    .replace(/([?!])([A-Z])/g, "$1\n\n$2")
    .replace(/ {2,}/g, " ")
    .trim();
}

// Password validation rule
function isValidPassword(password) {
  const minLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_\-+=<>?/{}[\]|\\]/.test(password);

  return minLength && hasUppercase && hasNumber && hasSpecial;
}

// --- Database setup ---
const dbPath = path.join(__dirname, "..", "database.sqlite");
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
  // --- Profile picture upload directory ---
  const profilePicDir = path.join(__dirname, "uploads/profile_pics");
  if (!fs.existsSync(profilePicDir)) {
  fs.mkdirSync(profilePicDir, { recursive: true });
  console.log("✅ Created profile_pics directory");
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Created uploads directory");
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
// --- Multer config for profile pictures ---
const profilePicStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/profile_pics"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `profile_${Date.now()}${ext}`);
  },
});

function profilePicFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPG or PNG images allowed"));
  }
  cb(null, true);
}

const uploadProfilePic = multer({
  storage: profilePicStorage,
  fileFilter: profilePicFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});


// --- Routes ---


// Root route → homepage
app.get("/", (req, res) => {
  res.redirect("../frontpage/front.html");
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "loginpage", "login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "registerpage", "signup.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "dashboard", "dashboard.html"));
});

app.get("/change-password", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontpage", "changePassword.html"));
});

app.get("/resume-page", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "dashboard", "resume.html"));
});

app.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "settingpage", "setting.html"));
});

app.get("/saved", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "savedjobs", "saved.html"));
});

// Allow the logged-in user to view their resume
app.get("/resume/view", (req, res) => {
  // accept token from Authorization header OR ?token= query param
  const authHeader = req.headers.authorization || "";
  const queryToken = req.query.token || "";
  const token = authHeader.startsWith("Bearer ") 
    ? authHeader.split(" ")[1] 
    : queryToken;

  if (!token) return res.status(401).json({ error: "No token provided" });

  let decoded;
  try {
    const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_later";
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const userId = decoded.user_id;

  db.get(
    `SELECT original_filename, mime_type, upload_path
     FROM resumes WHERE user_id = ? LIMIT 1`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!row) return res.status(404).json({ error: "No resume found" });

      res.setHeader("Content-Type", row.mime_type);
      res.setHeader("Content-Disposition", `inline; filename="${row.original_filename}"`);
      res.sendFile(path.resolve(row.upload_path));
    }
  );
});


app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

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
        const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_later";
        const token = jwt.sign({ user_id: this.lastID, email }, JWT_SECRET, { expiresIn: "2h" });
        return res.status(201).json({ message: "User created", token, user_id: this.lastID });
      }
    );
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

// LOGIN: verifies user + returns a token
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("Login attempt:", email);

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Server error" });

    console.log("User from DB:", user);

    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    console.log("Password match:", ok);

    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_later";
    const token = jwt.sign({ user_id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "2h" });

    return res.json({ message: "Logged in", token });
  });
});

// Change password
app.post("/change-password", requireAuth, async (req, res) => {
  const userId = req.user.user_id;
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: "All password fields are required." });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: "New passwords do not match." });
  }

  if (!isValidPassword(newPassword)) {
    return res.status(400).json({
      error: "Password must be at least 12 characters and include 1 uppercase letter, 1 number, and 1 special character."
    });
  }

  db.get("SELECT password_hash FROM users WHERE id = ?", [userId], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Database error." });
    }

    if (!row) {
      return res.status(404).json({ error: "User not found." });
    }

    const matches = await bcrypt.compare(currentPassword, row.password_hash);

    if (!matches) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    try {
      const newHash = await bcrypt.hash(newPassword, 10);

      db.run(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        [newHash, userId],
        function (updateErr) {
          if (updateErr) {
            return res.status(500).json({ error: "Failed to update password." });
          }

          return res.json({ message: "Password updated successfully." });
        }
      );
    } catch (hashErr) {
      return res.status(500).json({ error: "Server error." });
    }
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
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!row) return res.status(404).json({ error: "No resume found" });
      return res.json({ resume: row });
    }
  );
});


// Delete the logged-in user's resume (DB + file)
app.delete("/resume", requireAuth, (req, res) => {
  const userId = req.user.user_id;

  // 1) Find the user's resume
  db.get(
    `SELECT id, upload_path
     FROM resumes
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
    async (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!row) return res.status(404).json({ error: "No resume found" });

      // 2) Delete the file from disk (ignore if it's already missing)
      try {
        await fs.promises.unlink(row.upload_path);
      } catch (e) {
        if (e.code !== "ENOENT") {
          return res.status(500).json({ error: "File delete failed" });
        }
      }

      // 3) Delete the DB record
      db.run(`DELETE FROM resumes WHERE id = ?`, [row.id], function (delErr) {
        if (delErr) return res.status(500).json({ error: "Database delete failed" });
        return res.json({ message: "Resume deleted" });
      });
    }
  );
});

// STEP 1: Update/replace resume (just confirm request + file arrives)
app.put("/resume", requireAuth, upload.single("resume"), (req, res) => {
  console.log("PUT /resume hit");
  console.log("user:", req.user);      // should contain user_id from JWT
  console.log("file:", req.file);      // should contain uploaded file metadata

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  return res.status(200).json({
    message: "Resume received (step 1 ok)",
    filename: req.file.originalname,
    storedAs: req.file.filename,
    size: req.file.size,
  });
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

// Extract skills from uploaded resumes; Author: Caleb Perez, 04/30/26
app.get("/resume/skills", requireAuth, async (req, res) => {
  const userId = req.user.user_id;

  db.get(
    `SELECT mime_type, upload_path FROM resumes WHERE user_id = ? LIMIT 1`,
    [userId],
    async (err, row) => {
      if (err)  return res.status(500).json({ error: "Database error" });
      if (!row) return res.status(404).json({ error: "No resume found" });

      try {
        let text = "";

        if (row.mime_type === "application/pdf") {
          const buffer = await fs.promises.readFile(row.upload_path);
          const parsed = await pdfParse(buffer);
          text = parsed.text;
        } else {
          const result = await mammoth.extractRawText({ path: row.upload_path });
          text = result.value;
        }

        const skillKeywords = [
          "python", "java", "javascript", "typescript", "c++", "c#", "ruby",
          "go", "rust", "swift", "kotlin", "php", "r", "matlab", "scala",
          "html", "css", "react", "angular", "vue", "node", "express",
          "django", "flask", "spring", "rest", "graphql",
          "sql", "mysql", "postgresql", "mongodb", "firebase", "pandas",
          "numpy", "tensorflow", "pytorch", "machine learning", "data analysis",
          "aws", "azure", "gcp", "docker", "kubernetes", "git", "linux",
          "ci/cd", "jenkins", "terraform",
          "networking", "tcp/ip", "dns", "http", "cybersecurity",
          "wireshark", "bash", "powershell", "active directory",
          "communication", "teamwork", "leadership", "problem solving",
          "agile", "scrum", "project management"
        ];

        const lowerText = text.toLowerCase();
        const found = skillKeywords.filter(skill => lowerText.includes(skill));

        return res.json({ skills: found });

      } catch (e) {
        console.error("Resume parse error:", e.message);
        return res.status(500).json({ error: "Failed to parse resume" });
      }
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
