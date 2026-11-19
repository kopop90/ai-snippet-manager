import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ใช้โมเดลตระกูล 3.8 ที่รองรับ API Key ใหม่ (สลับวนกันกรณีติด 503 High Demand)
const FALLBACK_MODELS = [
  'gemini-3.8-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite', // ลองซ้ำอีกรอบเผื่อคิวว่างแล้ว
  'gemini-3.8-flash',
];

export async function POST(req: Request) {
  try {
    const { title, type, content, language } = await req.json();
    let textToAnalyze = content.slice(0, 4000);

    if (type === 'link') {
      try {
        const res = await fetch(content, { signal: AbortSignal.timeout(2500) });
        const html = await res.text();
        const plainText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        textToAnalyze = `URL: ${content}\nเนื้อหาเว็บ: ${plainText.slice(0, 2000)}`;
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

    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
      const modelName = FALLBACK_MODELS[i];
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedTitle: {
                  type: Type.STRING,
                  description: 'ชื่อหัวข้อสั้นๆ ไม่เกิน 50 ตัวอักษร',
                },
                detectedLanguage: {
                  type: Type.STRING,
                  description: 'ภาษาโปรแกรมตัวพิมพ์เล็ก 1 คำ เช่น typescript, python, sql หรือ url',
                },
                summary: {
                  type: Type.STRING,
                  description: 'สรุปภาษาไทยสั้นๆ 1-2 ประโยค',
                },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'แท็กภาษาอังกฤษตัวพิมพ์เล็ก 3-4 คำ',
                },
              },
              required: ['suggestedTitle', 'detectedLanguage', 'summary', 'tags'],
            },
          },
        });

        usedModel = modelName;
        console.log(`✅ AI Analysis สำเร็จด้วย: ${modelName} (รอบที่ ${i + 1})`);
        break;
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`❌ รอบที่ ${i + 1} (${modelName}) ไม่ผ่าน: ${msg}`);
        // หน่วงเวลา 1 วินาทีก่อนลองตัวถัดไป เผื่อเซิร์ฟเวอร์หายแน่น
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
    console.error('🚨 AI Analysis Error:', error);
    return NextResponse.json(
      { suggestedTitle: null, detectedLanguage: null, summary: null, tags: [], model: null },
      { status: 500 }
    );
  }
}