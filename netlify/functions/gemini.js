const { handle } = require('../../lib/gemini-proxy.cjs');
exports.handler = async (event) => handle({ method: event.httpMethod, headers: event.headers, body: event.body, isBase64Encoded: event.isBase64Encoded });
