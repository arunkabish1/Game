require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const { Question, Token } = require('./models');
const { signPayload } = require('./utils');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_game';
async function gen(){
  await mongoose.connect(MONGODB_URI);
  const questions = await Question.find().sort({ level: 1 }).lean();
  const tokens = [];
  for(const q of questions){
    const payload = { level: q.level, qid: `Q${q.level}`, issuedAt: Date.now() };
    const token = signPayload(payload);
    tokens.push({ level: q.level, token, issuedAt: Date.now() });
    await Token.findOneAndUpdate({ level: q.level }, { level: q.level, qid: `Q${q.level}`, token, issuedAt: Date.now() }, { upsert:true });
  }
  fs.writeFileSync('tokens.json', JSON.stringify(tokens, null, 2));
  console.log('Generated tokens.json with', tokens.length, 'tokens');
  await mongoose.disconnect();
}
gen().catch(err=>{ console.error(err); process.exit(1); });
