import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "./models/User.js";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// Session
app.use(
  session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  })
);

// DB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log(err));

// Auth Middleware
function isAuth(req, res, next) {
  if (req.session.userId) return next();
  res.redirect("/login");
}

// Routes
app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.render("login", { error: "Invalid credentials" });

  req.session.userId = user._id;
  res.redirect("/dashboard");
});

app.get("/register", (req, res) => res.render("register", { error: null }));
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const exist = await User.findOne({ username });
  if (exist) return res.render("register", { error: "User already exists" });

  const newUser = new User({ username, password, highScore: 0, level: 1 });
  await newUser.save();
  res.redirect("/login");
});

app.get("/dashboard", isAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render("dashboard", { user });
});

app.get("/settings", isAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render("settings", { user });
});

app.post("/settings", isAuth, async (req, res) => {
  const { password } = req.body;
  await User.findByIdAndUpdate(req.session.userId, { password });
  res.redirect("/settings");
});

app.post("/save-score", isAuth, async (req, res) => {
  const { score } = req.body;
  const user = await User.findById(req.session.userId);

  if (score > user.highScore) {
    user.highScore = score;
  }

  // 🔥 Level Unlock Rules
  if (user.highScore >= 30) user.level = 4;
  else if (user.highScore >= 20) user.level = 3;
  else if (user.highScore >= 10) user.level = 2;
  else user.level = 1;

  await user.save();
  res.json({ success: true, highScore: user.highScore, level: user.level });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Start Server
app.listen(process.env.PORT || 5000, () =>
  console.log("🚀 Server running on port " + (process.env.PORT || 5000))
);
