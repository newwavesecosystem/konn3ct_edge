import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for the Konn3ct external API (kv4).
 * 
 * This avoids CORS issues when the frontend (e.g. edge-test.konn3ct.net)
 * calls the external API (e.g. backend-api.konn3ct.net) directly from
 * the browser. By proxying through our own Next.js API route, the
 * browser only talks to the same origin.
 */

const EXTERNAL_API_URL =
  process.env.NEXT_PUBLIC_KONN3CT_EXTERNAL_API_URL ||
  "https://dev.konn3ct.ng/api/app/kv4";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const subPath = path.join("/");
  const targetUrl = `${EXTERNAL_API_URL}/${subPath}`;

  try {
    const body = await request.json();

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[kv4 proxy] Error forwarding to ${targetUrl}:`, err);
    return NextResponse.json(
      { success: false, message: "Unable to connect to validation service." },
      { status: 502 }
    );
  }
}
