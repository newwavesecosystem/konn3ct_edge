import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (process.env.NODE_ENV !== "production") return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
});
redis.on("error", () => {});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, sessionToken, isBot, pin } = body;

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

    // ── Access PIN enforcement (decision: enforced here in /api/join) ──────────
    // Fetch the room record to check accessPin and guestJoinAllowed.
    // We call the backend REST API instead of Prisma directly (Next.js is a separate process).
    try {
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
      // Use the internal rooms slug endpoint — requires a service-level auth header
      const roomRes = await fetch(`${backendUrl}/api/rooms/${roomId}`, {
        headers: {
          // Use a service JWT signed with the shared JWT_SECRET so the backend accepts it
          Authorization: `Bearer ${jwt.sign(
            { userId: "system", email: "system@conn3ct.internal" },
            process.env.JWT_SECRET || "fallback-secret-key",
            { expiresIn: "30s" }
          )}`,
        },
      });

      if (roomRes.ok) {
        const room = await roomRes.json() as {
          accessPin?: string | null;
          guestJoinAllowed?: boolean;
          mode?: string;
        };

        // 1. Enforce access PIN
        if (room.accessPin) {
          if (!pin || pin !== room.accessPin) {
            return NextResponse.json({ error: "Invalid or missing access PIN" }, { status: 403 });
          }
        }

        // 2. Enforce guest join allowed (hosts bypass this check)
        if (room.guestJoinAllowed === false && finalRole !== "host" && !isBot) {
          return NextResponse.json(
            { error: "Guest join is not allowed for this room" },
            { status: 403 }
          );
        }
      }
      // If room lookup fails (backend unreachable), we fall through gracefully —
      // the signaling server will still validate the room on WebSocket upgrade.
    } catch (e) {
      console.warn("Room lookup for PIN check failed — proceeding without PIN enforcement:", e);
    }

    // ── Redis capacity pre-flight check ────────────────────────────────────────
    try {
      const mappedPod = await redis.get(`room:${roomId}:pod`);
      if (mappedPod) {
        const cpuStr = await redis.get(`pod:${mappedPod}:cpu`);
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

    const payload: any = {
      userId: finalUserId,
      email: finalEmail,
      name: finalName,
      role: finalRole,
      isBot: !!isBot,
      isMobile: finalIsMobile,
    };

    // Forward any metadata from the session token (e.g. from external API)
    if (!isBot && sessionToken) {
      try {
        const sessionData = jwt.verify(sessionToken, secret) as any;
        if (sessionData.action) payload.action = sessionData.action;
        if (sessionData.ownerEmail) payload.ownerEmail = sessionData.ownerEmail;
        if (sessionData.roomName) payload.roomName = sessionData.roomName;
        if (sessionData.isWaitingRoomEnabled !== undefined) payload.isWaitingRoomEnabled = sessionData.isWaitingRoomEnabled;
      } catch (e) {
        // Already verified above — ignore
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
