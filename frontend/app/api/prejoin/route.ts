import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

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
    };

    // Encrypt the locked-down payload into a secure, stateless JWT token
    // This allows it to work seamlessly across Serverless / Kubernetes pods without Redis
    const secret = process.env.JWT_SECRET || "fallback-secret-key";
    const sessionToken = jwt.sign(sessionData, secret, { expiresIn: "2h" });

    return NextResponse.json({ sessionToken });
  } catch (error) {
    console.error("Prejoin error:", error);
    return NextResponse.json(
      { error: "Failed to create join session" },
      { status: 500 }
    );
  }
}
