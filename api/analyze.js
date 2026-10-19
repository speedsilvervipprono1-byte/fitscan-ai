export default async function handler(req, res) {
  // Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Lấy Gemini API Key từ biến môi trường của Vercel
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel' });
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
Chỉ trả về JSON:
{
  "isFood": true,
  "foodName": "Tên món tiếng Việt",
  "libraryName": "tên trong thư viện hoặc null",
  "confidence": số từ 0 đến 1,
  "category": "veg" | "meat" | "fried" | "gym" | "drinks" | "fruit",
  "calories": số nguyên, "protein": số, "carbs": số, "fat": số,
  "serving": "mô tả khẩu phần",
  "cheatAlert": true/false,
  "oilLevel": "mức dầu mỡ",
  "cheatNote": "lời khuyên ngắn",
  "burnout": "bài tập tiêu hao"
}`;

    const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let geminiResponse = null;
    let lastError = null;

    // Thử lần lượt các model Gemini
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
      return res.status(500).json({ error: 'Gemini không trả về dữ liệu văn bản' });
    }

    const result = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Lỗi xử lý hệ thống' });
  }
}
