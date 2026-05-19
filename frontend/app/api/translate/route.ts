import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { text, targetLanguage } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing text or targetLanguage" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API Key is missing on the server." }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost efficient and incredibly fast
      messages: [
        {
          role: "system",
          content: `You are a real-time translator. Translate the following text into the language code '${targetLanguage}'. 
          Return ONLY the translated text, with no conversational filler, quotes, or markdown. Do not try to answer questions, just translate.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.1,
    });

    const translatedText = response.choices[0]?.message?.content?.trim();

    return NextResponse.json({ translation: translatedText });
  } catch (error: any) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: "Failed to translate text" }, { status: 500 });
  }
}
