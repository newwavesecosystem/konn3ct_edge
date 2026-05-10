import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, name, email } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    // Method 1: Redis Pre-flight Rejection (Option A)
    const POD_ID = process.env.POD_ID || 'pod-1';
    const cpuStr = await redis.get(`pod:${POD_ID}:cpu`);
    
    if (cpuStr) {
      const cpuUsage = parseFloat(cpuStr);
      if (cpuUsage > 90) {
        return NextResponse.json({ 
          error: "This meeting is currently at maximum capacity (Server Overload). Please wait for someone to leave." 
        }, { status: 503 });
      }
    }

    const secret = process.env.JWT_SECRET || "fallback-secret-key";
    
    // Generate a secure JWT that the Kubernetes backend will accept
    // The backend's WebSocket verifier expects `userId` and `email`
    const token = jwt.sign(
      {
        userId: `user_${Math.random().toString(36).substr(2, 9)}`,
        email: email || "guest@conn3ct.com",
        name: name || "Guest",
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
