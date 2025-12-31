const mongoose = require('mongoose');
const { Schema } = mongoose;

/* ---------------- TEAM ---------------- */
const TeamSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },

  // GAME PROGRESS
  progress: { type: Number, default: 1 },   // starts at level 1
  total_time_ms: { type: Number, default: 0 },
  currentLevelStart: { type: Number, default: null },

  level_times: {
    type: Map,
    of: Number,
    default: {}
  },

  // 🔒 LOCK SYSTEM (IMPORTANT)
  lockUntil: { type: Number, default: null }
});

/* ---------------- QUESTION ---------------- */
const QuestionSchema = new Schema({
  level: Number,
  question: String,
  options: [String],
  answer: String
});

/* ---------------- TOKEN ---------------- */
const TokenSchema = new Schema({
  level: Number,
  qid: String,
  token: String,
  issuedAt: Number
});

/* ---------------- ATTEMPT ---------------- */
const AttemptSchema = new Schema({
  teamId: String,
  level: Number,
  answer: Schema.Types.Mixed,
  correct: Boolean,
  timeTaken: Number,
  ts: Number
});

module.exports = {
  Team: mongoose.model('Team', TeamSchema),
  Question: mongoose.model('Question', QuestionSchema),
  Token: mongoose.model('Token', TokenSchema),
  Attempt: mongoose.model('Attempt', AttemptSchema)
};
