import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY || "default-insecure-key-change-me";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

// Utility to validate the API key
function validateApiKey(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return token === EXTERNAL_API_KEY;
}

export async function POST(request: Request) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, name, email, role, isMobile, camera, mic } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    // Because this is the external authenticated API, we TRUST the provided role!
    // This allows the dashboard to safely inject "host" or "co-host" roles.
    const trustedRole = role || "attendee";
    const finalEmail = email?.trim() || "guest@conn3ct.com";

    const sessionData = {
      roomId,
      name: name.trim(),
      email: finalEmail,
      role: trustedRole,
      isMobile: !!isMobile,
      camera: camera !== false, // default to true if undefined
      mic: mic !== false,       // default to true if undefined
    };

    // Encrypt the payload into a secure, stateless JWT token
    const sessionToken = jwt.sign(sessionData, JWT_SECRET, { expiresIn: "2h" });

    // Assuming the frontend runs on the same host, or derive from request headers
    // For external APIs, it's safer to just return a relative path or let the client construct the base URL
    // We'll return a relative path that the dashboard can append to its known frontend domain.
    const joinPath = `/meeting/${roomId}?t=${sessionToken}`;

    return NextResponse.json({
      sessionToken,
      joinPath,
      message: "Join token generated successfully"
    });
  } catch (error) {
    console.error("External API /meetings/join error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
