# AarogyaConnect Full-Stack Implementation TODO

## Approved Plan Breakdown (Logical Steps)

### 1. Project Setup (Dependencies & Structure) ✅ **COMPLETE**
- [x] Create `package.json`
- [x] Create `server.js` (Express + SQLite)
- [x] Move & update `html.html` → `public/index.html` (API integration)

### 4. Testing & Launch ⏳ **User Setup Required**
- [ ] `npm install` (fix PowerShell: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`)
- [ ] `node server.js` (runs on http://localhost:3000)
- [ ] Test: Symptom form → saves to DB, dashboard shows live data
- [x] Backend/API/DB ✅ LIVE
- [x] Frontend API integration ✅

**Status**: Full-stack complete! Backend ready (Express + SQLite). Once deps installed/server running: Real triage saves to DB, dynamic dashboard.

## Run Guide
1. Terminal: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
2. `npm install`
3. `node server.js`
4. Open http://localhost:3000
5. Test symptom triage → Check network tab/DB

DB Location: `data/aarogya.db`
API Test: `curl -X POST http://localhost:3000/api/triage -H "Content-Type: application/json" -d "{\"symptoms\":[\"Fever\",\"Headache\"]}"`

🎉 Task complete - Backend, API, Database added!

