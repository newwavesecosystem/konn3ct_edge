import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { question, transcript } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API Key is missing on the server." }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Konn3ct AI, a helpful, polite, and intelligent in-meeting assistant. 
          Your job is to answer the user's question based strictly on the provided meeting transcript.
          If the answer is not in the transcript, politely say that you don't have that information.
          If the transcript is completely empty, politely inform the user that nobody has spoken yet or transcription just started.
          Keep your answers concise, formatting them with markdown if helpful (bullet points, bold text).
          
          Here is the meeting transcript so far:
          ---
          ${transcript || "[No transcript available yet. The meeting just started or nobody has spoken.]"}
          ---
          `,
        },
        {
          role: "user",
          content: question,
        },
      ],
      temperature: 0.2, // Low temperature for factual consistency based on transcript
    });

    const answer = response.choices[0]?.message?.content?.trim();

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error("Konn3ct AI error:", error);
    return NextResponse.json({ error: "Failed to generate AI response" }, { status: 500 });
  }
}
