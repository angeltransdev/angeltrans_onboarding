require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const app     = express();

const isProd = process.env.NODE_ENV === 'production';

// Allow requests from the React frontend (Vercel in prod, localhost in dev)
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://app.angeltransllc.com',
  'https://onboarding.angeltransllc.com',
  'https://client-puce-three-11.vercel.app',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// API routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/hr',       require('./routes/hr'));
app.use('/api/employee', require('./routes/employee'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Delete PDFs older than 24 hours — runs at startup and every hour after
const PDF_DIR = path.join(__dirname, 'pdfs');
const cleanOldPdfs = () => {
  if (!fs.existsSync(PDF_DIR)) return;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  fs.readdirSync(PDF_DIR).forEach(file => {
    const filePath = path.join(PDF_DIR, file);
    try {
      if (fs.statSync(filePath).mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old PDF: ${file}`);
      }
    } catch {}
  });
};
cleanOldPdfs();
setInterval(cleanOldPdfs, 60 * 60 * 1000);

// Serve built React app only when client/dist exists (VPS / self-hosted deployments).
// On Railway + Vercel, Vercel handles the frontend so this block is skipped.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (isProd && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Angel Trans API running on port ${PORT}`));
