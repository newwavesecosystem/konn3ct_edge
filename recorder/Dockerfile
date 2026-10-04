FROM node:22-bookworm-slim

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg xvfb \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 ffmpeg \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# If running Puppeteer on Debian/Ubuntu, installing these dependencies is highly recommended.
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    pulseaudio \
    pulseaudio-utils \
    alsa-utils \
    dbus \
    dbus-x11 \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Add Chrome policy to re-enable Manifest V2 extensions (required for puppeteer-stream)
RUN mkdir -p /etc/opt/chrome/policies/managed/ && \
    mkdir -p /etc/chromium/policies/managed/ && \
    echo '{ "ExtensionManifestV2Availability": 2 }' > /etc/opt/chrome/policies/managed/policy.json && \
    echo '{ "ExtensionManifestV2Availability": 2 }' > /etc/chromium/policies/managed/policy.json

# Add a script to run Xvfb, PulseAudio, and Node together
RUN echo '#!/bin/bash\n\
echo "recorder_audio_daemon_started"\n\
pulseaudio --start --exit-idle-time=-1 || pulseaudio -D --exit-idle-time=-1\n\
pactl load-module module-null-sink sink_name=recorder_sink sink_properties=device.description=RecorderSink\n\
echo "recorder_audio_sink_detected"\n\
pactl set-default-sink recorder_sink\n\
echo "recorder_audio_default_sink_set"\n\
pactl info\n\
pactl list short sinks\n\
echo "recorder_xvfb_started"\n\
xvfb-run --server-args="-screen 0 1920x1080x24" bash -c "echo \\\"recorder_display_detected\\\" && node index.js"' > start.sh
RUN chmod +x start.sh

CMD ["./start.sh"]
