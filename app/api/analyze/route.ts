import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// สลับข้ามโมเดลต่างรุ่นและขนาดที่มีอยู่ใน API Key จริง (แก้ปัญหา 503 High Demand)
const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

export async function POST(req: Request) {
  try {
    const { title, type, content, language } = await req.json();
    let textToAnalyze = content.slice(0, 3000);

    if (type === 'link') {
      try {
        const res = await fetch(content, { signal: AbortSignal.timeout(1500) });
        const html = await res.text();
        const plainText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        textToAnalyze = `URL: ${content}\nเนื้อหาเว็บ: ${plainText.slice(0, 1500)}`;
      } catch {
        textToAnalyze = `URL: ${content}`;
      }
    }

    const prompt = `วิเคราะห์ข้อมูลนี้สำหรับ Developer:
หัวข้อเดิม: ${title || '(ตั้งชื่อให้ใหม่สั้นๆ)'}
ประเภท: ${type === 'code' ? 'Code' : 'Bookmark'}
ภาษาที่เลือก: ${language}
เนื้อหา:
${textToAnalyze}`;

    let response;
    let usedModel = '';
    let lastError;

    for (const modelName of FALLBACK_MODELS) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedTitle: { type: Type.STRING },
                detectedLanguage: { type: Type.STRING },
                summary: { type: Type.STRING },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['suggestedTitle', 'detectedLanguage', 'summary', 'tags'],
            },
          },
        });

        usedModel = modelName;
        console.log(`✅ AI Success: ${modelName}`);
        break;
      } catch (err: unknown) {
        lastError = err;
        console.warn(`❌ Failed (${modelName}):`, err instanceof Error ? err.message : String(err));
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Empty response from AI');
    }

    const result = JSON.parse(response.text);
    return NextResponse.json({
      suggestedTitle: result.suggestedTitle || title || 'Untitled Snippet',
      detectedLanguage: (result.detectedLanguage || (type === 'link' ? 'url' : 'plaintext')).toLowerCase(),
      summary: result.summary || 'ไม่มีคำอธิบายเพิ่มเติม',
      tags: result.tags || [type],
      model: usedModel,
    });
  } catch (error) {
    console.error('🚨 API Error:', error);
    return NextResponse.json(
      { suggestedTitle: null, detectedLanguage: null, summary: null, tags: [], model: null },
      { status: 500 }
    );
  }
}