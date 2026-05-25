import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    // Don't reconnect endlessly in local development
    if (process.env.NODE_ENV !== "production") return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
});

// Swallow the unhandled error event so it doesn't spam the console in local dev
redis.on("error", () => {});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, sessionToken, isBot } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    // Default values if no session (only for bots or fallback)
    let finalUserId = `user_${Math.random().toString(36).substr(2, 9)}`;
    let finalEmail = "guest@conn3ct.com";
    let finalName = "Guest";
    let finalRole = isBot ? "bot" : "attendee";
    let finalIsMobile = false;

    if (isBot) {
      finalUserId = "bot_recorder";
    } else {
      if (!sessionToken) {
        return NextResponse.json({ error: "Missing session token" }, { status: 403 });
      }

      try {
        const secret = process.env.JWT_SECRET || "fallback-secret-key";
        const sessionData = jwt.verify(sessionToken, secret) as any;

        if (sessionData.roomId !== roomId) {
          return NextResponse.json({ error: "Invalid session for this room" }, { status: 403 });
        }

        finalName = sessionData.name;
        finalEmail = sessionData.email;
        finalRole = sessionData.role;
        finalIsMobile = sessionData.isMobile;
      } catch (err) {
        console.error("JWT Verification failed", err);
        return NextResponse.json({ error: "Session expired or invalid" }, { status: 403 });
      }
    }

    // Method 1: Redis Pre-flight Rejection (Option A)
    // Wrap in try/catch so local dev without Redis doesn't break
    try {
      // First, determine which Pod the NGINX router has assigned this room to
      const mappedPod = await redis.get(`room:${roomId}:pod`);

      console.log(`room:${roomId}:pod mappedPod`, mappedPod);

      // If the room is active on a pod, check that specific pod's CPU
      if (mappedPod) {
        const cpuStr = await redis.get(`pod:${mappedPod}:cpu`);
        console.log(`pod:${mappedPod}:cpu cpuStr`, cpuStr);
        if (cpuStr) {
          const cpuUsage = parseFloat(cpuStr);
          const maxRejectionLoad = parseFloat(process.env.MAX_REJECTION_CPU_LOAD || "90");
          if (cpuUsage > maxRejectionLoad) {
            return NextResponse.json({
              error: "This meeting is currently at maximum capacity (Server Overload). Please wait for someone to leave."
            }, { status: 503 });
          }
        }
      }
    } catch (e) {
      console.warn("Redis is unreachable. Skipping capacity check. (Normal in local dev)");
    }

    const secret = process.env.JWT_SECRET || "fallback-secret-key";

    // Generate a secure JWT that the Kubernetes backend will accept
    // The backend's WebSocket verifier expects `userId` and `email`
    // We MUST also forward any 'action' instructions (e.g. create_room_if_missing) from external APIs
    const payload: any = {
      userId: finalUserId,
      email: finalEmail,
      name: finalName,
      role: finalRole,
      isBot: !!isBot,
      isMobile: finalIsMobile,
    };

    // If the sessionToken contained room creation metadata, pass it along!
    if (!isBot && sessionToken) {
      try {
        const sessionData = jwt.verify(sessionToken, secret) as any;
        if (sessionData.action) payload.action = sessionData.action;
        if (sessionData.ownerEmail) payload.ownerEmail = sessionData.ownerEmail;
        if (sessionData.roomName) payload.roomName = sessionData.roomName;
        if (sessionData.isWaitingRoomEnabled !== undefined) payload.isWaitingRoomEnabled = sessionData.isWaitingRoomEnabled;
      } catch (e) {
        // Verification already happened above, so this should not fail, but we catch just in case
      }
    }

    const token = jwt.sign(payload, secret, { expiresIn: "24h" });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate connection token" },
      { status: 500 }
    );
  }
}
