const { handle } = require('../lib/gemini-proxy.cjs');
module.exports = async (req, res) => {
  const result = await handle({ method: req.method, headers: req.headers, body: req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : '' });
  for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
  res.status(result.statusCode).send(result.body);
};
