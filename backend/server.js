require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const { Team, Question, Token, Attempt } = require('./models');
const { verifyToken } = require('./utils');
const fs = require('fs');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_game';
const PORT = process.env.PORT || 5000;
mongoose.connect(MONGODB_URI).then(()=>console.log('Mongo connected')).catch(err=>{ console.error('Mongo error', err); process.exit(1); });
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }});
app.use(cors()); app.use(bodyParser.json());
async function computeLeaderboard(){
  const teams = await Team.find().lean();
  teams.sort((a,b) => {
    if(a.progress !== b.progress) return b.progress - a.progress;
    return (a.total_time_ms || 0) - (b.total_time_ms || 0);
  });
  return teams.map(t => ({ id: t.id, name: t.name, progress: t.progress, total_time_ms: t.total_time_ms || 0 }));
}
io.on('connection', socket => {
  socket.on('join', ({ teamId }) => { if(teamId) socket.join(teamId); });
});
app.post('/api/scan', async (req, res) => {
  try{ const { token, teamId } = req.body; if(!token || !teamId) return res.status(400).send({ error: 'token and teamId required' });
    const payload = verifyToken(token); if(!payload) return res.status(400).send({ error: 'invalid token' });
    const level = payload.level; const team = await Team.findOne({ id: teamId }); if(!team) return res.status(404).send({ error: 'team not found' });
    if(level !== team.progress) return res.status(403).send({ error: 'locked', allowed: team.progress });
    const question = await Question.findOne({ level }); team.currentLevelStart = Date.now(); await team.save();
    io.to(teamId).emit('level_started', { teamId, level, startTs: team.currentLevelStart });
    res.send({ question: question.question, level });
  }catch(err){ console.error(err); res.status(500).send({ error: 'server error' }); }
});
app.post('/api/answer', async (req, res) => {
  try {
    const { token, teamId, answer } = req.body;
    if (!token || !teamId || typeof answer === 'undefined')
      return res.status(400).send({ error: 'missing fields' });

    const payload = verifyToken(token);
    if (!payload) return res.status(400).send({ error: 'invalid token' });

    const level = payload.level;
    const team = await Team.findOne({ id: teamId });
    if (!team) return res.status(404).send({ error: 'team not found' });

    if (level !== team.progress)
      return res.status(403).send({ error: 'locked' });

    const question = await Question.findOne({ level });
    const correct =
      String(answer).trim().toLowerCase() ===
      String(question.answer).trim().toLowerCase();

    const now = Date.now();
    let timeTaken = null;

    // ---- UPDATED BLOCK: calculate time and store per-level times
    if (team.currentLevelStart) {
      timeTaken = now - team.currentLevelStart;

      // total time
      team.total_time_ms = (team.total_time_ms || 0) + timeTaken;

      // per-level time recording
      if (!team.level_times) team.level_times = new Map();
      team.level_times.set(String(level), timeTaken);

      // clear start
      team.currentLevelStart = null;
    }
    // ---- END UPDATED BLOCK

    // Save the attempt
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

      // emit real-time updates
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

app.get('/api/team/:id', async (req, res) => {
  try {
    const team = await Team.findOne({ id: req.params.id }).lean();
    if (!team) return res.status(404).json({ error: 'Team not found' });

    res.json({
      ok: true,
      team
    });
  } catch (err) {
    console.error('Team fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.get('/api/leaderboard', async (req, res) => { const lb = await computeLeaderboard(); res.send({ leaderboard: lb }); });
app.get('/', (req, res) => res.send({ ok: true }));
server.listen(PORT, () => { console.log('Server listening on', PORT); try{ const t = fs.readFileSync('tokens.json','utf8'); if(t) console.log('tokens.json present, tokens count:', JSON.parse(t).length); }catch(e){} });
