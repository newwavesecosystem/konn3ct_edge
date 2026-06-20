import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';
import { roomTranscripts } from '../signaling/server';

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

// --- 2. Get All AI Summaries (Past Meetings) ---
aiRouter.get('/summaries', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Find all rooms the user owns or is a team member of
    const rooms = await db.room.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { team: { members: { some: { userId } } } }
        ]
      },
      select: { id: true, name: true, slug: true }
    });
    
    const roomIds = rooms.map((r: any) => r.id);
    
    // Fetch all summaries for those rooms
    const summaries = await db.meetingSummary.findMany({
      where: { roomId: { in: roomIds } },
      orderBy: { createdAt: 'desc' }
    });
    
    // Attach room details
    const pastMeetings = summaries.map((s: any) => {
      const room = rooms.find((r: any) => r.id === s.roomId);
      return {
        ...s,
        roomName: room?.name || 'Unknown Room',
        roomSlug: room?.slug || ''
      };
    });
    
    res.status(200).json(pastMeetings);
  } catch (error) {
    logger.error('Error fetching summaries', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- 3. Generate/Get AI Summary ---
aiRouter.post('/summary/:roomId', async (req: Request, res: Response) => {
  try {
    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'AI summarisation is not configured on this server.' });
    }

    const roomId = req.params.roomId as string;
    const userId = req.user!.userId;

    // Verify ownership (only owners/admins should generate expensive AI summaries)
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const roomWithTeam = await db.room.findUnique({
      where: { id: roomId },
      include: { team: { include: { members: true } } }
    });
    let hasAccess = room.ownerId === userId;
    if (!hasAccess && roomWithTeam?.team) {
      hasAccess = roomWithTeam.team.members.some((m: any) => m.userId === userId && ['owner', 'admin'].includes(m.role));
    }
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden. Only room owners and team admins can generate AI summaries.' });

    // Fetch all transcriptions for this room
    const transcriptions = await db.transcription.findMany({ 
      where: { roomId },
      orderBy: { createdAt: 'asc' }
    });
    
    if (transcriptions.length === 0) {
      return res.status(400).json({ error: 'No transcriptions found to summarize.' });
    }

    const fullText = transcriptions.map((t: { content: string }) => t.content).join('\n');

    const { generateMeetingSummaryData } = require('../ai/summarizer');
    const { summary: summaryText, actionItems } = await generateMeetingSummaryData(fullText);

    if (summaryText === "Summary could not be generated.") {
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

// --- 4. Live Konn3ct AI Chat ---
aiRouter.post('/chat/:roomSlug', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    const roomSlugOrId = req.params.roomSlug as string;
    const userId = req.user!.userId;

    if (!question) {
      return res.status(400).json({ error: "Missing question" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API Key is missing on the server." });
    }

    // Verify room access (try by ID first, then fallback to slug)
    let room = await db.room.findUnique({
      where: { id: roomSlugOrId },
      include: { team: { include: { members: true } } }
    });

    if (!room) {
      room = await db.room.findUnique({
        where: { slug: roomSlugOrId },
        include: { team: { include: { members: true } } }
      });
    }

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const roomId = room.id;

    let hasAccess = room.ownerId === userId;
    if (!hasAccess && room.team) {
      hasAccess = room.team.members.some((m: any) => m.userId === userId);
    }
    if (!hasAccess && ((req.user as any).roomId === roomId || (req.user as any).roomId === room.slug)) {
      hasAccess = true;
    }
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    // Fetch live transcript from memory
    const transcripts = roomTranscripts.get(roomId) || [];
    const transcriptText = transcripts
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.name}: ${t.text}`)
      .join('\n');

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
          ${transcriptText || "[No transcript available yet. The meeting just started or nobody has spoken.]"}
          ---
          `,
        },
        {
          role: "user",
          content: question,
        },
      ],
      temperature: 0.2,
    });

    const answer = response.choices[0]?.message?.content?.trim();
    res.status(200).json({ answer });
  } catch (error: any) {
    logger.error("Konn3ct AI error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
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
