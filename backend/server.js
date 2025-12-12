require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");

// Import Models
const { Team, Question, Token, Attempt } = require("./models");

// Helpers
const { verifyToken } = require("./utils");

// Environment
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/qr_game";
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

// -------------------------------------
//  CONNECT MONGODB
// -------------------------------------
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error", err);
    process.exit(1);
  });

// -------------------------------------
// EXPRESS + SOCKET.IO SETUP
// -------------------------------------
const app = express();
const server = http.createServer(app);

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(bodyParser.json());

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("join", ({ teamId }) => {
    if (teamId) {
      socket.join(teamId);
      console.log(`📌 Team joined room: ${teamId}`);
    }
  });

  socket.on("disconnect", () => console.log("🔴 Client disconnected"));
});

// -------------------------------------
//  LEADERBOARD FUNCTION
// -------------------------------------
async function computeLeaderboard() {
  const teams = await Team.find().lean();

  teams.sort((a, b) => {
    if (a.progress !== b.progress) return b.progress - a.progress;
    return (a.total_time_ms || 0) - (b.total_time_ms || 0);
  });

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    progress: t.progress,
    total_time_ms: t.total_time_ms || 0,
  }));
}

// -------------------------------------
//  SCAN ENDPOINT
// -------------------------------------
app.post("/api/scan", async (req, res) => {
  try {
    const { token, teamId } = req.body;

    if (!token || !teamId) {
      return res.status(400).send({ error: "token and teamId required" });
    }

    const payload = verifyToken(token);
    if (!payload) return res.status(400).send({ error: "invalid token" });

    const level = payload.level;

    const team = await Team.findOne({ id: teamId });
    if (!team) return res.status(404).send({ error: "team not found" });

    if (level !== team.progress) {
      return res.status(403).send({
        error: "locked",
        allowed: team.progress,
      });
    }

    const question = await Question.findOne({ level });
    if (!question) return res.status(404).send({ error: "question not found" });

    // Start timer
    team.currentLevelStart = Date.now();
    await team.save();

    io.to(teamId).emit("level_started", {
      teamId,
      level,
      startTs: team.currentLevelStart,
    });

    return res.send({
      question: question.question,
      level,
    });
  } catch (err) {
    console.error("SCAN ERROR:", err);
    return res.status(500).send({ error: "server error" });
  }
});

// -------------------------------------
//  ANSWER ENDPOINT
// -------------------------------------
app.post("/api/answer", async (req, res) => {
  try {
    const { token, teamId, answer } = req.body;

    if (!token || !teamId || typeof answer === "undefined") {
      return res.status(400).send({ error: "missing fields" });
    }

    const payload = verifyToken(token);
    if (!payload) return res.status(400).send({ error: "invalid token" });

    const level = payload.level;
    const team = await Team.findOne({ id: teamId });

    if (!team) return res.status(404).send({ error: "team not found" });

    if (level !== team.progress) {
      return res.status(403).send({ error: "locked" });
    }

    const question = await Question.findOne({ level });
    if (!question) return res.status(404).send({ error: "question not found" });

    const correct =
      String(answer).trim().toLowerCase() ===
      String(question.answer).trim().toLowerCase();

    const now = Date.now();
    let timeTaken = null;

    // -------------------------
    // Time tracking
    // -------------------------
    if (team.currentLevelStart) {
      timeTaken = now - team.currentLevelStart;

      team.total_time_ms = (team.total_time_ms || 0) + timeTaken;

      if (!team.level_times || typeof team.level_times !== "object") {
        team.level_times = {};
      }

      team.level_times[String(level)] = timeTaken;
      team.currentLevelStart = null;
    }

    // Log attempt
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
      io.to(teamId).emit("team:update", team.toObject());

      return res.send({
        correct: true,
        nextLevel: team.progress,
      });
    }

    await team.save();
    return res.send({ correct: false });
  } catch (err) {
    console.error("ANSWER ERROR:", err);
    return res.status(500).send({ error: "server error" });
  }
});

// -------------------------------------
//  TEAM FETCH ENDPOINT
// -------------------------------------
app.get("/api/team/:id", async (req, res) => {
  try {
    const team = await Team.findOne({ id: req.params.id }).lean();
    if (!team) return res.status(404).json({ error: "Team not found" });

    return res.json({ ok: true, team });
  } catch (err) {
    console.error("TEAM FETCH ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// -------------------------------------
//  LEADERBOARD ROUTE
// -------------------------------------
app.get("/api/leaderboard", async (req, res) => {
  const leaderboard = await computeLeaderboard();
  res.send({ leaderboard });
});

// -------------------------------------
// ROOT
// -------------------------------------
app.get("/", (req, res) => res.send({ ok: true }));

// -------------------------------------
// START SERVER
// -------------------------------------
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  try {
    const t = fs.readFileSync("tokens.json", "utf8");
    console.log("📦 tokens.json loaded, tokens:", JSON.parse(t).length);
  } catch (e) {
    console.log("⚠️ No tokens.json found");
  }
});
