import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY || "default-insecure-key-change-me";

// Utility to validate the API key
function validateApiKey(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return token === EXTERNAL_API_KEY;
}

// Generate a random slug (e.g. vibrant-eagle-42) or just a UUID
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

    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // Body is optional
    }

    const { name, ownerEmail, isWaitingRoomEnabled } = body;
    const finalEmail = ownerEmail || "api_guest@conn3ct.com";
    const roomName = name || "API Created Meeting";

    // Lookup or create owner
    let owner = await db.user.findUnique({ where: { email: finalEmail } });
    if (!owner) {
      const randomPassword = randomUUID();
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      owner = await db.user.create({
        data: {
          email: finalEmail,
          name: finalEmail.split('@')[0],
          passwordHash
        }
      });
    }

    // Generate a URL-friendly room ID
    const roomSlug = generateRoomSlug();

    // Create room in database
    const room = await db.room.create({
      data: {
        name: roomName,
        slug: roomSlug,
        ownerId: owner.id,
        isWaitingRoomEnabled: isWaitingRoomEnabled !== false, // default true
      }
    });

    return NextResponse.json({
      roomId: room.slug,
      message: "Meeting created successfully"
    });
  } catch (error) {
    console.error("External API /meetings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
