const dotenv = require('dotenv');
const {
  createAccessToken,
  validateEnv
} = require('../../src/twilio');

dotenv.config();

const getAllowedOrigins = () => {
  if (!process.env.ALLOWED_ORIGIN) {
    return ['*'];
  }
  return process.env.ALLOWED_ORIGIN.split(',').map((origin) => origin.trim());
};

const buildCorsHeaders = (event) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = event.headers?.origin || event.headers?.Origin;

  let originHeader = '*';
  if (!allowedOrigins.includes('*') && requestOrigin) {
    if (allowedOrigins.includes(requestOrigin)) {
      originHeader = requestOrigin;
    } else {
      originHeader = allowedOrigins[0];
    }
  }

  return {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
};

exports.handler = async (event) => {
  const corsHeaders = buildCorsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  let payload = {};
  if (event.body) {
    try {
      payload = JSON.parse(event.body);
    } catch (err) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }
  }

  const identity = payload.identity || 'clickup-user';
  const missing = validateEnv();

  if (missing.length > 0) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Twilio environment variables not configured: ${missing.join(', ')}` })
    };
  }

  try {
    const token = createAccessToken(identity);
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: token.toJwt(), identity })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Failed to create access token' })
    };
  }
};
