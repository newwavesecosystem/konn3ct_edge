import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "";
  const logoName = appName === "Konn3ct" ? "konn3ct_logo.png" : "conference_logo.png";
  const logoPath = path.join(process.cwd(), "app", logoName);

  try {
    const buffer = fs.readFileSync(logoPath);
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch (e) {
    console.error("Failed to read icon logo file:", e);
    return new Response("Icon not found", { status: 404 });
  }
}
