import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: "https://nyc3.digitaloceanspaces.com",
  region: "nyc3",
  credentials: {
    accessKeyId: "DO00TB8YPEKNXNQWFL38",
    secretAccessKey: "yIRCfxEse4wigiUO1vGpkMnlY+yFlAE+NRUHke8pOPY"
  }
});

async function setCors() {
  const command = new PutBucketCorsCommand({
    Bucket: "kslas",
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
          AllowedOrigins: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000
        }
      ]
    }
  });

  try {
    await s3Client.send(command);
    console.log("CORS policy successfully applied to bucket 'kslas'!");
  } catch (error) {
    console.error("Error setting CORS:", error);
  }
}

setCors();
