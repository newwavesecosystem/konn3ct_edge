import { NextResponse } from "next/server";
import Redis from "ioredis";
import { randomUUID } from "crypto";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (process.env.NODE_ENV !== "production") return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1
});

// Swallow the unhandled error event so it doesn't spam the console in local dev
redis.on("error", () => {});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, name, email, isMobile, camera, mic } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    // Force the role to "attendee" to prevent malicious role elevation.
    // The legitimate host will join via a different secure dashboard endpoint.
    const secureRole = "attendee";
    const finalEmail = email?.trim() || "guest@conn3ct.com";

    // Create the session payload
    const sessionData = {
      roomId,
      name: name.trim(),
      email: finalEmail,
      role: secureRole,
      isMobile: !!isMobile,
      camera: !!camera,
      mic: !!mic,
      createdAt: Date.now()
    };

    // Generate a secure, unguessable token
    const sessionToken = randomUUID();

    try {
      // Store in Redis with a 2-hour (7200 seconds) expiration
      await redis.set(`prejoin_session:${sessionToken}`, JSON.stringify(sessionData), "EX", 7200);
    } catch (e) {
      console.warn("Redis is unreachable. Using fallback in-memory cache for local dev.");
      // In a real production app without Redis, this would fail.
      // But we degrade gracefully for local testing if Redis is down.
      (global as any)._fallbackSessions = (global as any)._fallbackSessions || new Map();
      (global as any)._fallbackSessions.set(sessionToken, sessionData);
    }

    return NextResponse.json({ sessionToken });
  } catch (error) {
    console.error("Prejoin error:", error);
    return NextResponse.json(
      { error: "Failed to create join session" },
      { status: 500 }
    );
  }
}
