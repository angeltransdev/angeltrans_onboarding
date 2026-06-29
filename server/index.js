require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const app     = express();

const isProd = process.env.NODE_ENV === 'production';

// Allow requests from the React frontend (Vercel in prod, localhost in dev)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// API routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/hr',       require('./routes/hr'));
app.use('/api/employee', require('./routes/employee'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve built React app only when client/dist exists (VPS / self-hosted deployments).
// On Railway + Vercel, Vercel handles the frontend so this block is skipped.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (isProd && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Angel Trans API running on port ${PORT}`));
