// -----------------------------
// ENV + IMPORTS
// -----------------------------
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");

const { Team, Question, Token, Attempt } = require("./models");
const { verifyToken } = require("./utils");

// -----------------------------
// CONFIG
// -----------------------------
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

if (!MONGODB_URI) {
  console.error("❌ ERROR: Missing MONGODB_URI");
  process.exit(1);
}

// -----------------------------
// DATABASE CONNECT
// -----------------------------
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error", err);
    process.exit(1);
  });

// -----------------------------
// EXPRESS + SOCKET.IO
// -----------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // In production, replace "*" with your Vercel frontend URL
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(bodyParser.json());

// -----------------------------
// HELPER: Leaderboard
// -----------------------------
async function computeLeaderboard() {
  const teams = await Team.find().lean();

  // Sort by:
  // 1) highest progress
  // 2) lowest total_time_ms
  teams.sort((a, b) => {
    if (a.progress !== b.progress) {
      return b.progress - a.progress;
    }
    return (a.total_time_ms || 0) - (b.total_time_ms || 0);
  });

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    progress: t.progress,
    total_time_ms: t.total_time_ms || 0,
    level_times: t.level_times ? Object.fromEntries(t.level_times) : {},
  }));
}

// -----------------------------
// SOCKET.IO EVENTS
// -----------------------------
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join", ({ teamId }) => {
    if (teamId) socket.join(teamId);
  });

  socket.on("request_leaderboard", async () => {
    const lb = await computeLeaderboard();
    socket.emit("leaderboard:update", lb);
  });
});

// -----------------------------
// API: BEGIN
// -----------------------------

// 1) SCAN QR → return question
app.post("/api/scan", async (req, res) => {
  try {
    const { token, teamId } = req.body;
    if (!token || !teamId)
      return res.status(400).send({ error: "token and teamId required" });

    const payload = verifyToken(token);
    if (!payload) return res.status(400).send({ error: "invalid token" });

    const level = payload.level;
    const team = await Team.findOne({ id: teamId });
    if (!team) return res.status(404).send({ error: "team not found" });

    if (level !== team.progress)
      return res.status(403).send({ error: "locked", allowed: team.progress });

    const question = await Question.findOne({ level });
    team.currentLevelStart = Date.now();
    await team.save();

    // Notify UI
    io.to(teamId).emit("level_started", {
      teamId,
      level,
      startTs: team.currentLevelStart,
    });

    res.send({
      question: question.question,
      level,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "server error" });
  }
});

// 2) ANSWER QUESTION
app.post("/api/answer", async (req, res) => {
  try {
    const { token, teamId, answer } = req.body;
    if (!token || !teamId || typeof answer === "undefined")
      return res.status(400).send({ error: "missing fields" });

    const payload = verifyToken(token);
    if (!payload) return res.status(400).send({ error: "invalid token" });

    const level = payload.level;
    const team = await Team.findOne({ id: teamId });
    if (!team) return res.status(404).send({ error: "team not found" });

    if (level !== team.progress)
      return res.status(403).send({ error: "locked" });

    const question = await Question.findOne({ level });
    const correct =
      String(answer).trim().toLowerCase() ===
      String(question.answer).trim().toLowerCase();

    const now = Date.now();
    let timeTaken = null;

    // Track level time
    if (team.currentLevelStart) {
      timeTaken = now - team.currentLevelStart;
      team.total_time_ms = (team.total_time_ms || 0) + timeTaken;

      if (!team.level_times) team.level_times = new Map();
      team.level_times.set(String(level), timeTaken);

      team.currentLevelStart = null;
    }

    await Attempt.create({
      teamId,
      level,
      answer,
      correct,
      timeTaken,
      ts: now,
    });

    if (correct) {
      team.progress = Math.min(10, team.progress + 1);
      await team.save();

      const leaderboard = await computeLeaderboard();

      io.emit("leaderboard:update", leaderboard);
      io.to(teamId).emit("team:update", team);

      return res.send({
        correct: true,
        nextLevel: team.progress,
      });
    } else {
      await team.save();
      return res.send({ correct: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "server error" });
  }
});

// 3) GET TEAM
app.get("/api/team/:id", async (req, res) => {
  try {
    const team = await Team.findOne({ id: req.params.id }).lean();
    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json({
      ok: true,
      team,
    });
  } catch (err) {
    console.error("Team fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 4) GET LEADERBOARD
app.get("/api/leaderboard", async (req, res) => {
  const lb = await computeLeaderboard();
  res.send({ leaderboard: lb });
});

// 5) ROOT CHECK
app.get("/", (req, res) => res.send({ ok: true }));

// -----------------------------
// START SERVER
// -----------------------------
server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);

  try {
    const t = fs.readFileSync("tokens.json", "utf8");
    if (t) console.log("tokens.json present, tokens count:", JSON.parse(t).length);
  } catch (e) {}
});
