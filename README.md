QR Game PWA repo:
- backend: MongoDB-enabled Express backend (see backend/ .env.example)
- frontend: Vite + React + Tailwind + PWA + ZXing scanner
How to run:
1. Start MongoDB locally or use cloud DB, set MONGODB_URI in backend/.env
2. cd backend && npm install && npm run seed && npm run gen-tokens && npm start
3. cd frontend && npm install && npm run dev
4. Open the frontend URL on mobile (or desktop) and install the PWA. Allow camera permissions.
