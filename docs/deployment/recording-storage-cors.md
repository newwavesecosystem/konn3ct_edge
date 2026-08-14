# Recording Storage CORS Configuration

When using AWS S3, DigitalOcean Spaces, or any S3-compatible storage provider for secure video playback, you must restrict CORS (Cross-Origin Resource Sharing) to your approved application origins.

Do not use broadly permissive `*` CORS policies, as this weakens security and allows unauthorized domains to embed your signed URLs if they leak.

## Required Origins
Restrict the `AllowedOrigins` to your specific environments:
- Local development (e.g., `http://localhost:3000`)
- Staging domain (e.g., `https://staging.konn3ct.com`)
- Production domain (e.g., `https://konn3ct.com`)

## Allowed Methods
Only minimal methods required for playback should be allowed:
- `GET`
- `HEAD`

## Allowed Headers
Browsers often send specific headers during `<video>` tag playback (like Range requests). 
- `Authorization`
- `Content-Range`
- `Accept-Ranges`
- `Range`

## Example: AWS S3 CORS Policy (JSON)

```json
[
    {
        "AllowedHeaders": [
            "Authorization",
            "Range",
            "Accept-Ranges",
            "Content-Range"
        ],
        "AllowedMethods": [
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://staging.konn3ct.com",
            "https://konn3ct.com"
        ],
        "ExposeHeaders": [
            "Accept-Ranges",
            "Content-Range",
            "Content-Encoding",
            "Content-Length"
        ],
        "MaxAgeSeconds": 3600
    }
]
```

## Example: DigitalOcean Spaces CORS (Dashboard)
1. Go to your Space settings.
2. Under "CORS Configurations", click "Add".
3. **Origin**: `http://localhost:3000`, `https://staging.konn3ct.com`, `https://konn3ct.com`
4. **Allowed Methods**: `GET`, `HEAD`
5. **Allowed Headers**: `Authorization`, `Range`, `Accept-Ranges`
6. **Expose Headers**: `Accept-Ranges`, `Content-Range`, `Content-Length`
7. Save changes.

## Common Browser Playback Errors
If CORS is misconfigured, you may see:
- `<video>` tag fails to load the source.
- Console error: `Access to video at 'https://...' from origin 'https://...' has been blocked by CORS policy`.
- Scrubbing/seeking the video fails (ensure `Range` headers are allowed and `Accept-Ranges`, `Content-Range` are exposed).
