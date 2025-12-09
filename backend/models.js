const mongoose = require('mongoose');
const { Schema } = mongoose;
const TeamSchema = new mongoose.Schema({
  id: String,
  name: String,
  progress: Number,
  total_time_ms: Number,
  currentLevelStart: Number,
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
