require("dotenv").config();
const mongoose = require("mongoose");
const { Team, Question } = require("./models");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/qr_game";

/* -----------------------------------
   QUESTIONS WITH OPTIONS (MCQ)
----------------------------------- */
const QUESTIONS = [
  {
    level: 1,
    question: "NFA எந்த வருடம் ஆரம்பிக்கப்பட்டது?",
    options: ["2010", "2011", "2013", "2015"],
    answer: "2013",
  },
  {
    level: 2,
    question: "NFA தமிழ் வகுப்புகளுக்கான மையங்கள் எத்தனை?",
    options: ["2", "3", "4", "5"],
    answer: "4",
  },
  {
    level: 3,
    question: "NFA-வில் தமிழ் வகுப்புகள் எந்த கிழமைகளில் நடக்கின்றன? (தமிழ் அல்லது ஆங்கிலம்)",
    options: ["வெள்ளி & சனி" || "Friday & Saturday", "சனி & ஞாயிறு" || "Saturday & Sunday", "ஞாயிறு & திங்கள்" || "Sunday & Monday", "திங்கள் & சோமர்ட்டு" || "Monday & Tuesday"],
    answer: "வெள்ளி & சனி" || "Friday & Saturday",
  },
  {
    level: 4,
    question: "மங்காப் மையத்தின் வகுப்பு நேரம் என்ன?",
    options: ["8.00–9.30", "9.30–11.00", "10.00–11.30", "Any time"],
    answer: "9.30–11.00" || "9.30 - 11.00",
  },
  {
    level: 5,
    question:
      "NFA வகுப்புகள் தமிழ்நாடு அரசின் எந்த அங்கீகரிக்கப்பட்ட துறையுடன் இணைக்கப்பட்டுள்ளன?",
    options: [
      "தமிழ் இணையவழிக் கல்வி",
      "தமிழ் வளர்ச்சித் துறை",
      "பள்ளிக் கல்வித் துறை",
      "பல்கலைக்கழகம்",
    ],
    answer: "தமிழ் இணையவழிக் கல்வி",
  },
  {
    level: 6,
    question: "NFA நிறுவனரின் பெயர் என்ன? (தமிழ் அல்லது ஆங்கிலம்)",
    options: ["செந்தை ரவி" || "Senthai Ravi", "ரவி குமார்" || "Ravi Kumar", "அருண் ரவி" || "Arun Ravi", "முரளி" || "Murli"],
    answer: "செந்தை ரவி" || "Senthai Ravi",
  },
  {
    level: 7,
    question: "இந்த NFA பொங்கல் விழாவின் ஆதரவாளர் (Sponsor) யார்?",
    options: ["Supreme Cargo", "ABC Logistics", "Star Transport", "NFA"],
    answer: "Supreme Cargo",
  },
  {
    level: 8,
    question: "கடந்த ஆண்டு NFA பொங்கல் விழா எந்த இடத்தில் நடைபெற்றது?",
    options: ["Mangaf", "Fahaheel", "Wafra", "Salmiya"],
    answer: "Wafra",
  },
  {
    level: 9,
    question: "NFA என்றால் என்ன? (தமிழ் அல்லது ஆங்கிலம்)",
    options: [
      "நந்தவனம் குடும்ப சங்கம் " || "Nandhavanam Family Association",
      "நந்தவனம் கல்வி அமைப்பு" || "Nandhavanam Education System",
      "தேசிய  அமைப்பு" || "National Federal Association",
      "நந்தவனம் தமிழ் சங்கம்" || "Nandhavanam Tamil Association",
    ],
    answer: "நந்தவனம் குடும்ப சங்கம்" || "Nandhavanam Family Association",
  },
  {
    level: 10,
    question: "Nandhavanam Family Association Website URL (eg - www.nandhavanam.com) ",
    options: ["www.nfa.kuwait", "www.nandhavanam.com", "nfakuwait", "www.nfa.in"],
    answer: "nfakuwait",
  },
];

/* -----------------------------------
   TEAMS
----------------------------------- */
const TEAMS = [
  { id: "team1", name: "Team Red" },
  { id: "team2", name: "Team Yellow" },
  { id: "team3", name: "Team Green" },
  { id: "team4", name: "Team Purple" },
  { id: "team5", name: "Team White" },
  { id: "team6", name: "Team Pink" },
];

/* -----------------------------------
   SEED FUNCTION
----------------------------------- */
async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to", MONGODB_URI);

  // ⚠️ Clear old data (IMPORTANT)
  await Question.deleteMany({});
  await Team.deleteMany({});

  // Insert fresh data
  await Question.insertMany(QUESTIONS);
  console.log("🌱 Questions seeded");

  await Team.insertMany(TEAMS);
  console.log("🌱 Teams seeded");

  await mongoose.disconnect();
  console.log("🎉 Done");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
