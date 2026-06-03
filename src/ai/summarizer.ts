import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function generateMeetingSummaryData(fullText: string): Promise<{ summary: string, actionItems: string }> {
  const MAX_TRANSCRIPT_CHARS = 30000;
  const truncatedText = fullText.length > MAX_TRANSCRIPT_CHARS
    ? fullText.substring(0, MAX_TRANSCRIPT_CHARS) + '\n[Transcript truncated for summarisation]'
    : fullText;

  let summary = "Summary could not be generated.";
  let actionItems = "[]";

  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI Meeting Assistant. Read the following meeting transcript and provide a brief overall summary and a JSON array of string action items.\n\nPlease format your response strictly as a JSON object with two fields: 'summary' (string) and 'actionItems' (array of strings). Do not include markdown formatting.",
          },
          {
            role: "user",
            content: truncatedText,
          },
        ],
        temperature: 0.3,
      });

      const aiResponse = response.choices[0]?.message?.content?.trim();
      if (aiResponse) {
        const cleanedText = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        summary = parsed.summary || summary;
        actionItems = JSON.stringify(Array.isArray(parsed.actionItems) ? parsed.actionItems : []);
        logger.info("Summary generated successfully via OpenAI.");
        return { summary, actionItems };
      }
    } catch (e) {
      logger.error('OpenAI summarization failed, falling back to Gemini', e);
    }
  }

  // Fallback to Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Analyze the following meeting transcript and provide a brief overall summary and a JSON array of string action items.\n\nTranscript:\n${truncatedText}\n\nPlease format your response strictly as a JSON object with two fields: "summary" (string) and "actionItems" (array of strings). Do not include markdown formatting.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      if (response.text) {
        const cleanedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        summary = parsed.summary || summary;
        actionItems = JSON.stringify(Array.isArray(parsed.actionItems) ? parsed.actionItems : []);
        logger.info("Summary generated successfully via Gemini.");
        return { summary, actionItems };
      }
    } catch (e) {
      logger.error('Gemini summarization failed', e);
    }
  }

  // If both fail or are unconfigured, return the default failure state.
  return { summary, actionItems };
}
