const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// DB Setup
const DB_PATH = path.join(__dirname, 'data', 'aarogya.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const db = new sqlite3.Database(DB_PATH);

// Init tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    age_group TEXT,
    phone TEXT,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS triages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    symptoms TEXT,  -- JSON array
    severity TEXT CHECK(severity IN ('Critical', 'Moderate', 'Stable')),
    recommendations TEXT,  -- JSON array
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    medicine TEXT,
    dose TEXT,
    time TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (patient_id) REFERENCES patients (id)
  )`);
});

// API Routes

// POST /api/triage - AI Symptom Triage (Mock AI logic)
app.post('/api/triage', (req, res) => {
  const { symptoms = [], age_group, name, phone, location } = req.body;

  if (symptoms.length === 0) {
    return res.status(400).json({ error: 'At least one symptom required' });
  }

  // Mock AI triage logic (based on frontend sim)
  const hasCritical = symptoms.some(s => ['Chest pain', 'Shortness of breath'].includes(s));
  const hasModerate = symptoms.some(s => ['Fever', 'Vomiting', 'Diarrhoea'].includes(s));
  
  let severity, recommendations = [], possible;

  if (hasCritical) {
    severity = 'Critical';
    possible = 'Cardiac / Respiratory Emergency';
    recommendations = [
      'Call 108 (National Emergency) right now',
      'Do not eat or drink anything',
      'Sit upright, loosen tight clothing'
    ];
  } else if (hasModerate) {
    severity = 'Moderate';
    possible = symptoms.includes('Fever') && symptoms.includes('Joint pain') ? 'Chikungunya' :
               symptoms.includes('Diarrhoea') ? 'Gastroenteritis / Typhoid' : 'Viral Infection';
    recommendations = [
      'Visit nearest PHC or CHC within 24 hours',
      'Stay hydrated — drink ORS every 2 hours',
      'Take only paracetamol for fever relief',
      'Monitor temperature every 4 hours'
    ];
  } else {
    severity = 'Stable';
    possible = 'Mild Condition — Self-Care Advised';
    recommendations = [
      'Rest well and stay hydrated',
      'Eat light, easily digestible food',
      'Monitor for worsening symptoms'
    ];
  }

  // Insert patient if new
  db.run('INSERT OR IGNORE INTO patients (name, age_group, phone, location) VALUES (?, ?, ?, ?)',
    [name || 'Anonymous', age_group || 'Adult', phone || null, location || 'Unknown'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      const patientId = this.lastID || 1;  // Fallback

      // Insert triage
      db.run('INSERT INTO triages (patient_id, symptoms, severity, recommendations) VALUES (?, ?, ?, ?)',
        [patientId, JSON.stringify(symptoms), severity, JSON.stringify(recommendations)],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({
            success: true,
            id: this.lastID,
            severity,
            possible,
            recommendations,
            patient_id: patientId,
            nearby: [
              { name: 'Sultanpur CHC', type: 'Community Health Centre', dist: '4.2 km' },
              { name: 'Dr. Anita Sharma Clinic', type: 'General Physician', dist: '6.8 km' }
            ]
          });
        }
      );
    }
  );
});

// GET /api/triages - Recent triages
app.get('/api/triages', (req, res) => {
  db.all(`
    SELECT t.*, p.name, p.location 
    FROM triages t 
    JOIN patients p ON t.patient_id = p.id 
    ORDER BY t.timestamp DESC 
    LIMIT 10
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => ({
      ...row,
      symptoms: JSON.parse(row.symptoms),
      recommendations: JSON.parse(row.recommendations)
    })));
  });
});

// GET /api/stats - Dashboard stats
app.get('/api/stats', (req, res) => {
  db.get(`
    SELECT 
      COUNT(DISTINCT p.id) as total_patients,
      COUNT(t.id) as total_triages,
      AVG((strftime('%s', 'now') - strftime('%s', t.timestamp)) / 60.0) as avg_response_min,
      (SELECT COUNT(*) FROM triages WHERE severity = 'Critical') as critical_cases
    FROM patients p LEFT JOIN triages t ON p.id = t.patient_id
  `, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      total_patients: row.total_patients || 0,
      total_triages: row.total_triages || 0,
      avg_response_min: Math.round((row.avg_response_min || 0) * 100) / 100,
      critical_cases: row.critical_cases || 0,
      top_symptoms: ['Fever', 'Headache', 'Cough']  // Mock aggregate
    });
  });
});

// POST /api/reminders - Add reminder
app.post('/api/reminders', (req, res) => {
  const { patient_id, medicine, dose, time } = req.body;
  db.run(
    'INSERT INTO reminders (patient_id, medicine, dose, time) VALUES (?, ?, ?, ?)',
    [patient_id, medicine, dose, time],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// GET /api/reminders - List reminders
app.get('/api/reminders', (req, res) => {
  db.all('SELECT * FROM reminders ORDER BY time ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', db_path: DB_PATH });
});

// 404
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AarogyaConnect Server running at http://localhost:${PORT}`);
  console.log(`📊 API Docs: http://localhost:${PORT}/api/health`);
  console.log(`💾 DB at: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

module.exports = app;

