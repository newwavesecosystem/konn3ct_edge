import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';

export const aiRouter = Router();

aiRouter.use(requireAuth);

// --- 1. Get Transcription ---
aiRouter.get('/transcription/:roomId', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId as string;
    const userId = req.user!.userId;

    // Verify room access
    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { team: { include: { members: true } } }
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    let hasAccess = room.ownerId === userId;
    if (!hasAccess && room.team) {
      hasAccess = room.team.members.some((m: any) => m.userId === userId);
    }
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const transcriptions = await db.transcription.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json(transcriptions);
  } catch (error) {
    logger.error('Error fetching transcription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- 2. Generate/Get AI Summary ---
aiRouter.post('/summary/:roomId', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId as string;
    const userId = req.user!.userId;

    // Verify ownership (only owners/admins should generate expensive AI summaries)
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room || room.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden. Only room owners can generate AI summaries.' });
    }

    // Fetch all transcriptions for this room
    const transcriptions = await db.transcription.findMany({ 
      where: { roomId },
      orderBy: { createdAt: 'asc' }
    });
    
    if (transcriptions.length === 0) {
      return res.status(400).json({ error: 'No transcriptions found to summarize.' });
    }

    const fullText = transcriptions.map(t => t.content).join('\n');

    let actionItems = "[]";
    let summaryText = "Summary could not be generated.";

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Analyze the following meeting transcript and provide a brief overall summary and a JSON array of string action items.\n\nTranscript:\n${fullText}\n\nPlease format your response strictly as a JSON object with two fields: "summary" (string) and "actionItems" (array of strings). Do not include markdown formatting.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      if (response.text) {
        const cleanedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        summaryText = parsed.summary || summaryText;
        actionItems = JSON.stringify(parsed.actionItems || []);
      }
    } catch (aiError) {
      logger.error('Failed to call Gemini API', aiError);
      return res.status(502).json({ error: 'AI processing failed' });
    }

    // Upsert the summary
    const summary = await db.meetingSummary.upsert({
      where: { roomId },
      update: {
        actionItems,
        summary: summaryText
      },
      create: {
        roomId,
        actionItems,
        summary: summaryText
      }
    });

    logger.info(`AI Summary generated for room ${roomId}`);
    res.status(200).json(summary);
  } catch (error) {
    logger.error('Error generating AI summary', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

aiRouter.get('/summary/:roomId', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId as string;
    const userId = req.user!.userId;

    // Verify access
    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { team: { include: { members: true } } }
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    let hasAccess = room.ownerId === userId;
    if (!hasAccess && room.team) {
      hasAccess = room.team.members.some((m: any) => m.userId === userId);
    }
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const summary = await db.meetingSummary.findUnique({
      where: { roomId }
    });

    if (!summary) {
      return res.status(404).json({ error: 'No summary generated yet.' });
    }

    res.status(200).json(summary);
  } catch (error) {
    logger.error('Error fetching AI summary', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
