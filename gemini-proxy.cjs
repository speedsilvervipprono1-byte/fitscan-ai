const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3-flash-preview').split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY_BYTES = 7 * 1024 * 1024;
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 8;
const buckets = new Map(); // best-effort per-instance rate limit; configure platform-level limits too.

function reply(statusCode, body, extraHeaders = {}) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }, body: JSON.stringify(body) };
}
function rateLimited(ip) {
  const now = Date.now();
  const prev = buckets.get(ip);
  if (!prev || now - prev.start >= WINDOW_MS) { buckets.set(ip, { start: now, count: 1 }); return false; }
  prev.count += 1;
  return prev.count > MAX_REQUESTS_PER_WINDOW;
}
async function handle({ method, headers = {}, body, isBase64Encoded = false }) {
  if (method !== 'POST') return reply(405, { error: { message: 'Method not allowed' } }, { Allow: 'POST' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return reply(503, { error: { message: 'Máy chủ chưa cấu hình GEMINI_API_KEY.' } });
  const raw = body || '';
  const approxBytes = Buffer.byteLength(raw, isBase64Encoded ? 'base64' : 'utf8');
  if (approxBytes > MAX_BODY_BYTES) return reply(413, { error: { message: 'Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 5 MB.' } });
  let parsed;
  try { parsed = JSON.parse(isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw); }
  catch { return reply(400, { error: { message: 'Yêu cầu JSON không hợp lệ.' } }); }
  const payload = parsed?.payload;
  const parts = payload?.contents?.[0]?.parts;
  const imagePart = Array.isArray(parts) && parts.find(p => p?.inlineData?.data);
  const textPart = Array.isArray(parts) && parts.find(p => typeof p?.text === 'string');
  if (!imagePart || !textPart || typeof imagePart.inlineData.data !== 'string' || imagePart.inlineData.data.length > 6_500_000) {
    return reply(400, { error: { message: 'Thiếu ảnh hoặc nội dung phân tích không hợp lệ.' } });
  }
  const mime = imagePart.inlineData.mimeType;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return reply(400, { error: { message: 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.' } });
  const ip = String(headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || headers['client-ip'] || 'unknown').split(',')[0].trim().slice(0, 80);
  if (rateLimited(ip)) return reply(429, { error: { message: 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau một phút.' } }, { 'Retry-After': '60' });

  let last = { status: 502, message: 'Gemini không phản hồi.' };
  for (const model of MODELS) {
    let upstream;
    try {
      upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000)
      });
    } catch {
      return reply(502, { error: { message: 'Không kết nối được Gemini. Hãy thử lại.' } });
    }
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { error: { message: 'Phản hồi Gemini không hợp lệ.' } }; }
    if (upstream.ok) return reply(200, data);
    last = { status: upstream.status, body: data };
    if (upstream.status !== 404) break;
  }
  const status = [400, 401, 403, 404, 429].includes(last.status) ? last.status : 502;
  return reply(status, last.body || { error: { message: 'Gemini request failed.' } });
}
module.exports = { handle };
