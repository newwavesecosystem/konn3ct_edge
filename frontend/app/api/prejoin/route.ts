import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { roomId, name, email, isMobile, camera, mic } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    if (name && name.trim().length > 64) {
      return NextResponse.json({ error: 'Name too long (max 64 characters)' }, { status: 400 });
    }
    // Validate email format if provided
    if (email && email !== 'guest@conn3ct.com') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
    }

    // Force the role to "attendee" to prevent malicious role elevation.
    // The legitimate host will join via a different secure dashboard endpoint.
    const secureRole = "attendee";
    const finalEmail = email?.trim() || "guest@conn3ct.com";

    // Generate a random stable userId for guests
    const guestUserId = `guest_${Math.random().toString(36).substring(2, 10)}`;

    // Create the session payload
    const sessionData = {
      userId: guestUserId,
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
    const sessionToken = jwt.sign(sessionData, process.env.JWT_SECRET!, { expiresIn: "2h" });

    return NextResponse.json({ sessionToken });
  } catch (error) {
    console.error("Prejoin error:", error);
    return NextResponse.json(
      { error: "Failed to create join session" },
      { status: 500 }
    );
  }
}
