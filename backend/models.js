const mongoose = require('mongoose');
const { Schema } = mongoose;

const TeamSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },

  // IMPORTANT DEFAULTS
  progress: { type: Number, default: 1 },  // Teams always start at Level 1
  total_time_ms: { type: Number, default: 0 },
  currentLevelStart: { type: Number, default: null },

  level_times: {
    type: Map,
    of: Number,
    default: {}
  }
});

const QuestionSchema = new Schema({
  level: { type: Number, unique: true },
  question: String,
  answer: String
});

const TokenSchema = new Schema({
  level: Number,
  qid: String,
  token: String,
  issuedAt: Number
});

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
