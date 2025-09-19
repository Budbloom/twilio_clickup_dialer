const twilio = require('twilio');

const requiredEnv = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_API_KEY',
  'TWILIO_API_SECRET',
  'TWILIO_TWIML_APP_SID'
];

const getAllowedOrigins = () => {
  if (!process.env.ALLOWED_ORIGIN) {
    return true;
  }
  return process.env.ALLOWED_ORIGIN.split(',').map((origin) => origin.trim());
};

const validateEnv = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  return missing;
};

const createAccessToken = (identity) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  const accessToken = new twilio.jwt.AccessToken(accountSid, apiKey, apiSecret, { identity });

  const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true
  });

  accessToken.addGrant(voiceGrant);

  return accessToken;
};

const buildVoiceResponse = (toNumber) => {
  const response = new twilio.twiml.VoiceResponse();

  if (!toNumber) {
    response.say('Missing destination number.');
    return response;
  }

  const callerId = process.env.TWILIO_CALLER_ID;

  const dial = response.dial({ callerId: callerId || undefined });
  dial.number(toNumber);

  return response;
};

module.exports = {
  createAccessToken,
  buildVoiceResponse,
  getAllowedOrigins,
  validateEnv
};
