import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ใช้ตระกูล flash-lite ขึ้นก่อน เพื่อความเร็วสูงสุด (< 1-2 วินาที) และสลับไปตัวหลักเมื่อจำเป็น
const FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
];

export async function POST(req: Request) {
  try {
    const { title, type, content, language } = await req.json();
    let textToAnalyze = content.slice(0, 3000);

    if (type === "link") {
      try {
        const res = await fetch(content, { signal: AbortSignal.timeout(1500) });
        const html = await res.text();
        const plainText = html
          .replace(/<[^>]*>?/gm, " ")
          .replace(/\s+/g, " ")
          .trim();
        textToAnalyze = `URL: ${content}\nเนื้อหาเว็บ: ${plainText.slice(0, 1500)}`;
      } catch {
        textToAnalyze = `URL: ${content}`;
      }
    }

    const prompt = `วิเคราะห์ข้อมูลนี้สำหรับ Developer และตอบเป็น JSON ตามกฎนี้:
1. suggestedTitle: ตั้งชื่อภาษาอังกฤษสั้นๆ กระชับ ไม่เกิน 10 คำ (ถ้ามีหัวข้อเดิมที่ดีอยู่แล้วให้ใช้หัวข้อเดิม)
2. detectedLanguage: ระบุชื่อภาษาโปรแกรมเป็นตัวพิมพ์เล็ก (เช่น python, typescript, sql, bash) หรือ url ถ้าเป็นลิงก์
3. summary: สรุปการทำงานหรือใจความสำคัญเป็น "ภาษาไทย" เท่านั้น ความยาว 1-2 ประโยค กระชับเข้าใจง่าย
4. tags: สร้างแท็กภาษาอังกฤษตัวพิมพ์เล็กที่เกี่ยวข้อง 3-5 คำ (ไม่ต้องมีเครื่องหมาย #)

ข้อมูลที่ต้องวิเคราะห์:
หัวข้อเดิม: ${title || "(ไม่มี)"}
ประเภท: ${type === "code" ? "Code" : "Bookmark"}
ภาษาที่เลือก: ${language}
เนื้อหา:
${textToAnalyze}`;

    let response;
    let usedModel = "";
    let lastError;

    for (const modelName of FALLBACK_MODELS) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
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
              required: [
                "suggestedTitle",
                "detectedLanguage",
                "summary",
                "tags",
              ],
            },
          },
        });

        usedModel = modelName;
        console.log(`✅ AI Success: ${modelName}`);
        break;
      } catch (err: unknown) {
        lastError = err;
        console.warn(
          `❌ Failed (${modelName}):`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Empty response from AI");
    }

    const result = JSON.parse(response.text);
    return NextResponse.json({
      suggestedTitle: result.suggestedTitle || title || "Untitled Snippet",
      detectedLanguage: (
        result.detectedLanguage || (type === "link" ? "url" : "plaintext")
      ).toLowerCase(),
      summary: result.summary || "ไม่มีคำอธิบายเพิ่มเติม",
      tags: result.tags || [type],
      model: usedModel,
    });
  } catch (error) {
    console.error("🚨 API Error:", error);
    return NextResponse.json(
      {
        suggestedTitle: null,
        detectedLanguage: null,
        summary: null,
        tags: [],
        model: null,
      },
      { status: 500 },
    );
  }
}
