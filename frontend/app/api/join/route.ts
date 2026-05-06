import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, name, email } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
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
