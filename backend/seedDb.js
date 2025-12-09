require('dotenv').config();
const mongoose = require('mongoose');
const { Team, Question } = require('./models');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_game';
const QUESTIONS = [
  { level: 1, question: "What is 2+2?", answer: "4" },
  { level: 2, question: "What is the capital of France?", answer: "Paris" },
  { level: 3, question: "What color do you get mixing red and white?", answer: "Pink" },
  { level: 4, question: "How many hours in a day?", answer: "24" },
  { level: 5, question: "What is the 3rd planet from the Sun?", answer: "Earth" },
  { level: 6, question: "How many continents are there?", answer: "7" },
  { level: 7, question: "What is H2O commonly called?", answer: "Water" },
  { level: 8, question: "What day comes after Monday?", answer: "Tuesday" },
  { level: 9, question: "What is the square root of 81?", answer: "9" },
  { level: 10, question: "Final: Type 'WIN' to finish", answer: "WIN" }
];
const TEAMS = [
  { id: "team1", name: "Team Alpha" },
  { id: "team2", name: "Team Bravo" },
  { id: "team3", name: "Team Charlie" },
  { id: "team4", name: "Team Delta" },
  { id: "team5", name: "Team Echo" },
  { id: "team6", name: "Team Foxtrot" }
];
async function seed(){
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to', MONGODB_URI);
  const qCount = await Question.countDocuments();
  if(qCount === 0){
    await Question.insertMany(QUESTIONS);
    console.log('Seeded questions');
  } else { console.log('Questions already seeded'); }
  const tCount = await Team.countDocuments();
  if(tCount === 0){
    await Team.insertMany(TEAMS);
    console.log('Seeded teams');
  } else { console.log('Teams already seeded'); }
  await mongoose.disconnect();
  console.log('Done');
}
seed().catch(err=>{ console.error(err); process.exit(1); });
