const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const {
  createAccessToken,
  buildVoiceResponse,
  getAllowedOrigins,
  validateEnv
} = require('./twilio');

dotenv.config();

const app = express();
const allowedOrigins = getAllowedOrigins();
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/token', (req, res) => {
  const identity = req.body.identity || 'clickup-user';
  const missing = validateEnv();

  if (missing.length > 0) {
    return res.status(500).json({ error: `Twilio environment variables not configured: ${missing.join(', ')}` });
  }

  try {
    const token = createAccessToken(identity);
    res.json({ token: token.toJwt(), identity });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create access token' });
  }
});

app.post('/voice', (req, res) => {
  const toNumber = req.body.To || req.query.To;
  const twiml = buildVoiceResponse(toNumber);

  res.type('text/xml');
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Voice token server listening on http://localhost:${PORT}`);
});
