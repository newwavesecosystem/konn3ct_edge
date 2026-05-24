import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

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

// Generate a random slug
function generateRoomSlug() {
  const adjectives = ["quick", "bright", "smart", "cool", "calm", "vibrant", "blue", "swift"];
  const nouns = ["eagle", "fox", "river", "mountain", "ocean", "sky", "forest", "star"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}-${noun}-${num}`;
}

export async function POST(request: Request) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, role, isMobile, camera, mic, roomName } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const roomSlug = generateRoomSlug();
    
    // Default to host if not specified, since this is a "create and join" action
    const trustedRole = role || "host";
    const finalEmail = email?.trim() || "host@conn3ct.com";
    const finalRoomName = roomName || "API Created Meeting";

    // Lookup or create owner
    let owner = await db.user.findUnique({ where: { email: finalEmail } });
    if (!owner) {
      const randomPassword = randomUUID();
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      owner = await db.user.create({
        data: {
          email: finalEmail,
          name: name.trim(),
          passwordHash
        }
      });
    }

    // Create room in database
    const room = await db.room.create({
      data: {
        name: finalRoomName,
        slug: roomSlug,
        ownerId: owner.id,
      }
    });

    const sessionData = {
      roomId: room.slug,
      name: name.trim(),
      email: finalEmail,
      role: trustedRole,
      isMobile: !!isMobile,
      camera: camera !== false, // default to true
      mic: mic !== false,       // default to true
    };

    // Encrypt the payload into a secure, stateless JWT token
    const sessionToken = jwt.sign(sessionData, JWT_SECRET, { expiresIn: "2h" });
    const joinPath = `/meeting/${room.slug}?t=${sessionToken}`;

    return NextResponse.json({
      roomId: room.slug,
      sessionToken,
      joinPath,
      message: "Meeting created and host token generated successfully"
    });
  } catch (error) {
    console.error("External API /meetings/create-and-join error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
