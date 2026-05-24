import { NextResponse } from "next/server";
import Redis from "ioredis";

const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY || "default-insecure-key-change-me";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (process.env.NODE_ENV !== "production") return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
});

redis.on("error", () => {}); // Swallow unhandled errors

function validateApiKey(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return token === EXTERNAL_API_KEY;
}

export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomId = params.roomId;
    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId parameter" }, { status: 400 });
    }

    let participantsStr = null;
    try {
      participantsStr = await redis.get(`room:${roomId}:participants`);
    } catch (e) {
      console.warn("Failed to get room status from Redis", e);
      return NextResponse.json({ error: "Status service unavailable" }, { status: 503 });
    }

    if (!participantsStr) {
      return NextResponse.json({
        isRunning: false,
        participantCount: 0,
        participants: []
      });
    }

    const participants = JSON.parse(participantsStr);
    
    return NextResponse.json({
      isRunning: true,
      participantCount: participants.length,
      participants
    });

  } catch (error) {
    console.error("External API /status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
