FROM node:20-slim

# Install FFmpeg, Python3, and yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    && rm -rf /var/lib/apt-get/lists/*

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Port 7860 for Hugging Face Spaces / Port 3000 for Render & Koyeb
EXPOSE 7860 3000

ENV PORT=7860

CMD ["node", "server.js"]
