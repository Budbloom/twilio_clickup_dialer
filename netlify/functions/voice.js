const dotenv = require('dotenv');
const querystring = require('querystring');
const {
  buildVoiceResponse,
  validateEnv
} = require('../../src/twilio');

dotenv.config();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Method Not Allowed'
    };
  }

  const missing = validateEnv();
  if (missing.length > 0) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: `Twilio environment variables not configured: ${missing.join(', ')}`
    };
  }

  let params = {};
  if (event.body) {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    params = querystring.parse(rawBody);
  }

  const toNumber = params.To || event.queryStringParameters?.To;
  const twiml = buildVoiceResponse(toNumber);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: twiml.toString()
  };
};
