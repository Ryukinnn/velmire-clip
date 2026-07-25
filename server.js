const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fluentFfmpeg = require('fluent-ffmpeg');
const localtunnel = require('localtunnel');

// Set FFmpeg Path
fluentFfmpeg.setFfmpegPath(ffmpegInstaller.path);
const FFMPEG_BIN = ffmpegInstaller.path;

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_SUBDOMAIN = process.env.SUBDOMAIN || 'velmire-clip-pro';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('bypass-tunnel-reminder', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Ensure output & temp directories exist
const outputDir = path.join(__dirname, 'output');
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(outputDir));

const jobs = {};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function normalizeYoutubeUrl(url) {
  if (!url) return '';
  url = url.trim();
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch && shortMatch[1]) {
    return `https://www.youtube.com/watch?v=${shortMatch[1]}`;
  }
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch && shortsMatch[1]) {
    return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
  }
  return url;
}

// Parse VTT subtitle file
function parseVttSubtitles(vttFilePath) {
  const items = [];
  if (!vttFilePath || !fs.existsSync(vttFilePath)) return items;

  try {
    const content = fs.readFileSync(vttFilePath, 'utf8');
    const lines = content.split(/\r?\n/);
    let currentStart = null;
    let currentEnd = null;

    for (let line of lines) {
      const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      if (timeMatch) {
        currentStart = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
        currentEnd = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]);
      } else if (line.trim() && !line.includes('WEBVTT') && !line.match(/^\d+$/)) {
        if (currentStart !== null) {
          const cleanText = line.replace(/<[^>]*>/g, '').trim();
          if (cleanText) {
            items.push({ startSec: currentStart, endSec: currentEnd, text: cleanText });
          }
        }
      }
    }
  } catch (e) {
    console.warn('VTT parse warning:', e);
  }
  return items;
}

// AI FYP Highlight Finder Algorithm
function analyzeFypHighlights(subtitles, totalDurationSec, targetClipDurationSec, count = 1) {
  const windows = [];
  const hookKeywords = [
    'rahasia', 'bahkan', 'caranya', 'penting', 'kunci', 'kamu', 'lu', 'gua', 'saya',
    'jangan', 'terbukti', 'miliarder', 'omset', 'berhasil', 'gimana', 'kenapa',
    'fakta', 'sebenarnya', 'alasan', 'tips', 'trik', 'strategi', 'secret', 'key', 'important'
  ];

  const effectiveDuration = totalDurationSec || 600;
  const maxStart = Math.max(10, effectiveDuration - targetClipDurationSec - 10);
  const step = 10;
  const scoredWindows = [];

  for (let s = 15; s <= maxStart; s += step) {
    const e = s + targetClipDurationSec;
    let score = 50;

    if (subtitles.length > 0) {
      const windowSubs = subtitles.filter(item => item.startSec >= s && item.startSec <= e);
      const textConcat = windowSubs.map(w => w.text.toLowerCase()).join(' ');
      const wordCount = textConcat.split(/\s+/).length;
      score += Math.min(40, wordCount * 0.4);

      for (const kw of hookKeywords) {
        if (textConcat.includes(kw)) score += 15;
      }
    } else {
      const ratio = s / effectiveDuration;
      if (ratio >= 0.15 && ratio <= 0.45) score += 30;
      else if (ratio >= 0.45 && ratio <= 0.70) score += 20;
    }

    scoredWindows.push({ startSec: s, endSec: e, durationSec: targetClipDurationSec, score });
  }

  scoredWindows.sort((a, b) => b.score - a.score);

  for (const item of scoredWindows) {
    if (windows.length >= count) break;
    const overlap = windows.some(w => Math.abs(w.startSec - item.startSec) < targetClipDurationSec * 0.8);
    if (!overlap) windows.push(item);
  }

  if (windows.length === 0) {
    const defaultStart = Math.min(30, Math.max(0, Math.floor(effectiveDuration * 0.2)));
    windows.push({ startSec: defaultStart, endSec: defaultStart + targetClipDurationSec, durationSec: targetClipDurationSec, score: 80 });
  }

  return windows;
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    developer: 'Ryukinnn',
    time: new Date().toISOString(),
    localIps: getLocalIpAddresses()
  });
});

// Create Auto-FYP Clip Endpoint
app.post('/api/clip', async (req, res) => {
  try {
    const { url: rawUrl, platform, numClips, subLang, subtitleStyle } = req.body;

    if (!rawUrl) {
      return res.status(400).json({ error: 'URL YouTube wajib diisi!' });
    }

    const url = normalizeYoutubeUrl(rawUrl);
    const jobId = uuidv4();

    let targetClipDuration = 35;
    if (platform === 'tiktok') targetClipDuration = 30;
    if (platform === 'wa_story') targetClipDuration = 20;
    if (platform === 'climax') targetClipDuration = 55;

    const count = parseInt(numClips) || 1;
    const selectedSubLang = subLang || 'id';

    jobs[jobId] = {
      id: jobId,
      status: 'downloading',
      statusMessage: 'Menganalisis video & subtitle...',
      progress: 10,
      createdAt: new Date(),
      clips: [],
      error: null
    };

    res.json({ jobId, message: 'Server sedang memproses klip & subtitle...' });

    processAutoFypJob(jobId, { url, platform, targetClipDuration, count, subLang: selectedSubLang, subtitleStyle });
  } catch (err) {
    console.error('Error creating clip job:', err);
    res.status(500).json({ error: err.message });
  }
});

// Status Polling Endpoint
app.get('/api/status/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    return res.status(404).json({ error: 'Job tidak ditemukan' });
  }
  res.json(job);
});

// Async Processing Engine
async function processAutoFypJob(jobId, options) {
  const job = jobs[jobId];
  const { url, platform, targetClipDuration, count, subLang, subtitleStyle } = options;

  const rawVideoPath = path.join(tempDir, `raw_${jobId}.mp4`);

  try {
    job.status = 'downloading';
    job.statusMessage = `Mendownload video & subtitle (${subLang.toUpperCase()})...`;
    job.progress = 20;

    const ffmpegEscaped = FFMPEG_BIN.replace(/\\/g, '/');

    const subLangFlag = subLang === 'auto' ? 'id,en,ja,ko,es,fr,de,ar' : `${subLang},id,en`;
    const ytDlpCmd = `yt-dlp --ffmpeg-location "${ffmpegEscaped}" --write-auto-sub --sub-lang "${subLangFlag}" --sub-format "vtt" -o "${tempDir}/sub_${jobId}.%(ext)s" -f "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best" --no-playlist -o "${rawVideoPath}" "${url}"`;

    await new Promise((resolve, reject) => {
      exec(ytDlpCmd, { maxBuffer: 1024 * 1024 * 50 }, (error) => {
        if (error) {
          const fallbackCmd = `yt-dlp --ffmpeg-location "${ffmpegEscaped}" -f "mp4" --no-playlist -o "${rawVideoPath}" "${url}"`;
          exec(fallbackCmd, (err2) => {
            if (err2) return reject(new Error('Gagal mendownload video YouTube. Pastikan link valid.'));
            resolve();
          });
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(rawVideoPath)) {
      throw new Error('File video tidak ditemukan.');
    }

    const totalDurationSec = await new Promise((resolve) => {
      fluentFfmpeg.ffprobe(rawVideoPath, (err, metadata) => {
        if (err || !metadata || !metadata.format) return resolve(600);
        resolve(Math.floor(metadata.format.duration || 600));
      });
    });

    let targetVttFile = null;
    const files = fs.readdirSync(tempDir);
    for (const f of files) {
      if (f.startsWith(`sub_${jobId}`) && f.endsWith('.vtt')) {
        if (f.includes(`.${subLang}.`) || !targetVttFile) {
          targetVttFile = path.join(tempDir, f);
        }
      }
    }

    const parsedSubtitles = parseVttSubtitles(targetVttFile);

    job.status = 'clipping';
    job.statusMessage = 'Memotong potongan 9:16...';
    job.progress = 45;

    const fypHighlights = analyzeFypHighlights(parsedSubtitles, totalDurationSec, targetClipDuration, count);

    job.status = 'rendering';
    job.statusMessage = `Rendering video 9:16 & Subtitle (${subLang.toUpperCase()})...`;
    job.progress = 60;

    const generatedClips = [];

    for (let i = 0; i < fypHighlights.length; i++) {
      const hl = fypHighlights[i];
      const clipFilename = `clip_${subLang}_${jobId.slice(0, 6)}_${i + 1}.mp4`;
      const clipOutputPath = path.join(outputDir, clipFilename);

      let filterComplex = 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=720:1280';

      if (subtitleStyle !== 'none') {
        const segSubs = parsedSubtitles.filter(s => s.startSec >= hl.startSec && s.startSec <= hl.endSec);
        let sampleText = segSubs.length > 0 ? segSubs[0].text : (i === 0 ? '🔥 HIGHLIGHT KLIP' : `HIGHLIGHT #${i+1}`);
        sampleText = sampleText.replace(/'/g, '').replace(/:/g, ' - ').slice(0, 40);

        filterComplex += `,drawtext=text='${sampleText}':fontcolor=white:fontsize=36:box=1:boxcolor=black@0.6:boxborderw=10:x=(w-text_w)/2:y=h-th-80`;
      }

      await new Promise((resolve, reject) => {
        fluentFfmpeg(rawVideoPath)
          .setStartTime(hl.startSec)
          .setDuration(hl.durationSec)
          .videoFilters(filterComplex)
          .outputOptions([
            '-c:v libx264',
            '-preset ultrafast',
            '-crf 23',
            '-c:a aac',
            '-b:a 128k',
            '-movflags +faststart'
          ])
          .output(clipOutputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      const startM = Math.floor(hl.startSec / 60);
      const startS = Math.floor(hl.startSec % 60);
      const endM = Math.floor(hl.endSec / 60);
      const endS = Math.floor(hl.endSec % 60);
      const label = `${String(startM).padStart(2, '0')}:${String(startS).padStart(2, '0')} - ${String(endM).padStart(2, '0')}:${String(endS).padStart(2, '0')}`;

      generatedClips.push({
        title: `Klip Potongan #${i + 1} (${hl.durationSec}s)`,
        timeLabel: label,
        ratio: '9:16',
        url: `/output/${clipFilename}`
      });
    }

    if (fs.existsSync(rawVideoPath)) fs.unlinkSync(rawVideoPath);
    for (const f of files) {
      if (f.startsWith(`sub_${jobId}`)) fs.unlinkSync(path.join(tempDir, f));
    }

    job.status = 'selesai';
    job.statusMessage = 'Selesai';
    job.progress = 100;
    job.clips = generatedClips;
    if (generatedClips.length > 0) job.outputUrl = generatedClips[0].url;

    console.log(`[SUCCESS] ${jobId} -> Created ${generatedClips.length} Clips`);
  } catch (err) {
    console.error(`[FAILED] ${jobId}:`, err);
    job.status = 'failed';
    job.statusMessage = 'Gagal';
    job.error = err.message;
    if (fs.existsSync(rawVideoPath)) fs.unlinkSync(rawVideoPath);
  }
}

// Start Server & Localtunnel
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`=================================================`);
  console.log(`⚡ Velmire Server by Ryukinnn running!`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Local Wi-Fi: http://192.168.1.14:${PORT}`);

  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: PUBLIC_SUBDOMAIN });
    console.log(`🌐 Public Live HTTPS URL: ${tunnel.url}`);
    console.log(`=================================================`);
  } catch (err) {
    console.warn('Localtunnel start warning:', err.message);
  }
});
