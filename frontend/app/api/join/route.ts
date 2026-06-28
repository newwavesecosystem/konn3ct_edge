import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "crypto";
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

export async function POST(request: NextRequest) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { roomId, sessionToken, isBot, isPing, pin } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    if (isPing) {
      return NextResponse.json({ token: "ping_ok" });
    }

    // Default values if no session (only for bots or fallback)
    let finalUserId = `user_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    let finalEmail = "guest@conn3ct.com";
    let finalName = "Guest";
    let finalRole = isBot ? "bot" : "attendee";
    let finalIsMobile = false;

    if (isBot) {
      const botToken = request.nextUrl.searchParams.get('botToken') || request.headers.get('Authorization')?.split(' ')[1];
      if (!botToken) {
        return NextResponse.json({ error: 'Unauthorized: missing bot token' }, { status: 401 });
      }
      try {
        const decoded = jwt.verify(botToken, process.env.JWT_SECRET!) as any;
        if (decoded.purpose !== 'recording_bot') {
          console.error(JSON.stringify({ event: 'bot_join_rejected', reason: 'BOT_TOKEN_AUDIENCE_INVALID', roomSlug: roomId, status: 403 }));
          return NextResponse.json({ error: 'Invalid bot token purpose' }, { status: 403 });
        }
        if (decoded.role !== 'recorder' && decoded.role !== 'bot') {
          console.error(JSON.stringify({ event: 'bot_join_rejected', reason: 'BOT_TOKEN_ROLE_REJECTED', claimRole: decoded.role, roomSlug: roomId, status: 403 }));
          return NextResponse.json({ error: 'Invalid bot token role' }, { status: 403 });
        }
        if (decoded.roomId !== roomId && decoded.roomSlug !== roomId) {
          console.error(JSON.stringify({ event: 'bot_join_rejected', reason: 'BOT_TOKEN_ROOM_MISMATCH', claimRoomId: decoded.roomId, claimRoomSlug: decoded.roomSlug, expectedRoom: roomId, roomSlug: roomId, status: 403 }));
          return NextResponse.json({ error: 'Invalid bot token room mismatch' }, { status: 403 });
        }
      } catch (err) {
        console.error(JSON.stringify({ event: 'bot_join_rejected', reason: 'BOT_TOKEN_INVALID_SIGNATURE', roomSlug: roomId, status: 401 }));
        return NextResponse.json({ error: 'Expired or malformed bot token' }, { status: 401 });
      }
      finalUserId = 'bot_recorder';
      finalRole = 'bot';
    } else {
      let isDashboardUser = false;
      const authCookie = request.headers.get("cookie");
      if (authCookie) {
        try {
          const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
          const meRes = await fetch(`${backendUrl}/api/auth/me`, {
            headers: { Cookie: authCookie }
          });
          if (meRes.ok) {
            const user = await meRes.json();
            if (user && user.id) {
              isDashboardUser = true;
              finalName = user.name;
              finalEmail = user.email;
              finalUserId = user.id;
              finalRole = "host";
            }
          }
        } catch (e) {
          console.error("Backend auth check failed", e);
        }
      }

      if (!isDashboardUser && !sessionToken) {
        return NextResponse.json({ error: "Missing session token" }, { status: 403 });
      }

      if (!isDashboardUser) {
        try {
          const sessionData = jwt.verify(sessionToken, process.env.JWT_SECRET!) as any;

          if (sessionData.roomId !== roomId) {
            return NextResponse.json({ error: "Invalid session for this room" }, { status: 403 });
          }

          finalName = sessionData.name;
          finalEmail = sessionData.email;
          finalRole = sessionData.role;
          finalIsMobile = sessionData.isMobile;
          if (sessionData.userId) finalUserId = sessionData.userId;
        } catch (err) {
          console.error("JWT Verification failed", err);
          return NextResponse.json({ error: "Session expired or invalid" }, { status: 403 });
        }
      }
    }

    // ── Access PIN enforcement (decision: enforced here in /api/join) ──────────
    // Fetch the room record to check accessPin and guestJoinAllowed.
    // We call the backend REST API instead of Prisma directly (Next.js is a separate process).
    let fetchedRoomLimits: any = {};
    try {
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
      // Use the internal rooms slug endpoint — requires a service-level auth header
      const serviceSecret = process.env.SERVICE_JWT_SECRET || process.env.JWT_SECRET!;
      const roomRes = await fetch(`${backendUrl}/api/rooms/${roomId}`, {
        headers: {
          // Use a service JWT signed with the shared SERVICE_JWT_SECRET so the backend accepts it
          Authorization: `Bearer ${jwt.sign(
            { userId: "system", email: "system@conn3ct.internal" },
            serviceSecret,
            { expiresIn: "30s" }
          )}`,
        },
      });

      if (roomRes.ok) {
        const room = await roomRes.json() as {
          accessPin?: string | null;
          guestJoinAllowed?: boolean;
          mode?: string;
          maxParticipants?: number;
          maxWebinarAudience?: number;
          maxActiveCameras?: number;
        };

        fetchedRoomLimits = {
          maxParticipants: room.maxParticipants ?? 100,
          maxWebinarAudience: room.maxWebinarAudience ?? 1000,
          maxActiveCameras: room.maxActiveCameras ?? 15,
        };

        // 1. Enforce access PIN (timing-safe comparison)
        if (room.accessPin) {
          const pinBuffer = Buffer.from(pin || '');
          const storedBuffer = Buffer.from(room.accessPin || '');
          const pinMatch = pinBuffer.length === storedBuffer.length &&
            timingSafeEqual(pinBuffer, storedBuffer);
          if (!pinMatch) {
            return NextResponse.json({ error: 'Incorrect access PIN' }, { status: 403 });
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

    const payload: any = {
      userId: finalUserId,
      email: finalEmail,
      name: finalName,
      role: finalRole,
      roomId: roomId,
      isBot: !!isBot,
      isMobile: finalIsMobile,
      ...fetchedRoomLimits
    };

    // Forward any metadata from the session token (e.g. from external API)
    if (!isBot && sessionToken) {
      try {
        const sessionData = jwt.verify(sessionToken, process.env.JWT_SECRET!) as any;
        if (sessionData.action) payload.action = sessionData.action;
        if (sessionData.ownerEmail) payload.ownerEmail = sessionData.ownerEmail;
        if (sessionData.roomName) payload.roomName = sessionData.roomName;
        if (sessionData.isWaitingRoomEnabled !== undefined) payload.isWaitingRoomEnabled = sessionData.isWaitingRoomEnabled;
      } catch (e) {
        // Already verified above — ignore
      }
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "24h" });
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate connection token" },
      { status: 500 }
    );
  }
}
