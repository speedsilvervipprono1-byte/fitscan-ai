// api/analyze.js
export default async function handler(req, res) {
  // Cho phép CORS để web gọi ổn định
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cài đặt GEMINI_API_KEY trên Vercel Environment Variables' });
  }

  try {
    const { base64Image, mimeType, libraryNames } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'Thiếu dữ liệu hình ảnh' });
    }

    const promptText = `Bạn là chuyên gia dinh dưỡng món Việt. Hãy nhận diện món ăn/đồ uống chính trong ảnh.
Danh sách món trong thư viện: ${libraryNames || ''}.
Quy tắc:
- Nếu ảnh khớp một món trong danh sách, đặt "libraryName" đúng y nguyên tên đó. Nếu không khớp, đặt "libraryName": null.
- Nếu ảnh không có món ăn, đặt "isFood": false.
- Ước lượng dinh dưỡng cho khẩu phần nhìn thấy trong ảnh.
Chỉ trả về JSON thuần túy, không kèm markdown code block:
{
  "isFood": true,
  "foodName": "Tên món tiếng Việt",
  "libraryName": "tên trong thư viện hoặc null",
  "confidence": 0.95,
  "category": "veg",
  "calories": 250,
  "protein": 20,
  "carbs": 15,
  "fat": 10,
  "serving": "1 phần vừa",
  "cheatAlert": false,
  "oilLevel": "Thấp",
  "cheatNote": "Cân bằng tốt",
  "burnout": "20 phút đi bộ"
}`;

    const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let geminiResponse = null;
    let lastError = null;

    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: promptText },
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Image } }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      });

      if (response.ok) {
        geminiResponse = await response.json();
        break;
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = errJson?.error?.message || `HTTP ${response.status}`;
      }
    }

    if (!geminiResponse) {
      return res.status(500).json({ error: 'Lỗi từ Gemini API: ' + lastError });
    }

    const rawText = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ error: 'Gemini không trả về kết quả' });
    }

    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanText);
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống' });
  }
}
