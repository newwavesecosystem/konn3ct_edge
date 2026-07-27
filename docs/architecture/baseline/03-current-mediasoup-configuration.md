# 03 Current Mediasoup Configuration
- Workers: `os.cpus().length`
- Audio Codec: Opus (DTX and FEC enabled)
- Video Codec: H264 (packetization-mode=1, profile-level-id=42e01f)
- WebRTC Transport: UDP and TCP fallback configured.
