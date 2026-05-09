import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT || "https://nyc3.digitaloceanspaces.com",
  region: process.env.DO_SPACES_REGION || "nyc3",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || "",
    secretAccessKey: process.env.DO_SPACES_SECRET || ""
  }
});

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType, fileSize } = await req.json();

    if (!filename || !contentType || !fileSize) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Enforce 1GB limit (1024 * 1024 * 1024)
    if (fileSize > 1073741824) {
      return NextResponse.json({ error: "File exceeds 1GB limit" }, { status: 400 });
    }

    // Generate unique key
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const key = `konn3ct/chat_files/${uniqueId}_${safeFilename}`;

    const bucket = process.env.DO_SPACES_BUCKET || "kslas";

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ACL: "public-read", // Makes the uploaded file public
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const endpoint = process.env.DO_SPACES_ENDPOINT || "https://nyc3.digitaloceanspaces.com";
    const endpointUrl = new URL(endpoint);
    const publicUrl = `https://${bucket}.${endpointUrl.hostname}/${key}`;

    return NextResponse.json({ presignedUrl, publicUrl, key });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
