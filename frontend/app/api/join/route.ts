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
  maxRetriesPerRequest: 1
});

// Swallow the unhandled error event so it doesn't spam the console in local dev
redis.on("error", () => {});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, name, email, role, isBot } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
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
    const token = jwt.sign(
      {
        userId: isBot ? "bot_recorder" : `user_${Math.random().toString(36).substr(2, 9)}`,
        email: email || "guest@conn3ct.com",
        name: name || "Guest",
        role: isBot ? "bot" : (role || "attendee"),
        isBot: !!isBot,
      },
      secret,
      { expiresIn: "24h" }
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate connection token" },
      { status: 500 }
    );
  }
}
