// Velmire Mobile Client Engine by Ryukinnn - Auto Multi-Backend Engine
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const ytUrlInput = document.getElementById('ytUrl');
  const btnPaste = document.getElementById('btnPaste');
  const platformSelect = document.getElementById('platformSelect');
  const subLangSelect = document.getElementById('subLangSelect');
  const numClipsSelect = document.getElementById('numClipsSelect');
  const subtitleStyleSelect = document.getElementById('subtitleStyle');
  const btnCreateClip = document.getElementById('btnCreateClip');
  const queueList = document.getElementById('queueList');
  const emptyPlaceholder = document.getElementById('emptyPlaceholder');

  // Server Modal Elements
  const toggleServerModalBtn = document.getElementById('toggleServerModal');
  const serverModal = document.getElementById('serverModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const presetRenderBtn = document.getElementById('presetRender');
  const presetHuggingFaceBtn = document.getElementById('presetHuggingFace');
  const presetAutoFindBtn = document.getElementById('presetAutoFind');
  const presetTestConnectionBtn = document.getElementById('presetTestConnection');
  const testConnectionStatus = document.getElementById('testConnectionStatus');
  const btnSaveApi = document.getElementById('btnSaveApi');
  const serverDot = document.getElementById('serverDot');

  const CANDIDATE_ENDPOINTS = [
    'https://velmire-clip.onrender.com',
    'https://ryukinnn-velmire-clip.hf.space',
    'http://192.168.1.14:3000'
  ];

  let activeApiUrl = localStorage.getItem('velmire_api_url') || CANDIDATE_ENDPOINTS[0];
  apiUrlInput.value = activeApiUrl;

  // Clipboard Paste Handler
  btnPaste.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) ytUrlInput.value = text.trim();
      } else {
        alert('Silakan tekan lama dan tempel tautan YouTube pada kolom input.');
      }
    } catch (err) {
      alert('Silakan tempel tautan YouTube secara manual.');
    }
  });

  // Modal Controls
  toggleServerModalBtn.addEventListener('click', () => {
    apiUrlInput.value = activeApiUrl;
    testConnectionStatus.textContent = '';
    serverModal.classList.remove('hidden');
  });

  btnCloseModal.addEventListener('click', () => serverModal.classList.add('hidden'));

  if (presetRenderBtn) presetRenderBtn.addEventListener('click', () => apiUrlInput.value = CANDIDATE_ENDPOINTS[0]);
  if (presetHuggingFaceBtn) presetHuggingFaceBtn.addEventListener('click', () => apiUrlInput.value = CANDIDATE_ENDPOINTS[1]);

  if (presetAutoFindBtn) {
    presetAutoFindBtn.addEventListener('click', async () => {
      testConnectionStatus.style.color = 'var(--text-muted)';
      testConnectionStatus.textContent = '⚡ Memindai semua server cloud aktif...';

      let found = null;
      for (const ep of CANDIDATE_ENDPOINTS) {
        try {
          const res = await fetch(`${ep}/api/health`, { method: 'GET' });
          if (res.ok) {
            found = ep;
            break;
          }
        } catch (e) {}
      }

      if (found) {
        activeApiUrl = found;
        apiUrlInput.value = activeApiUrl;
        localStorage.setItem('velmire_api_url', activeApiUrl);
        testConnectionStatus.style.color = '#34D399';
        testConnectionStatus.textContent = `✅ Server Aktif Ditemukan: ${found}`;
        serverDot.classList.add('connected');
      } else {
        testConnectionStatus.style.color = '#F87171';
        testConnectionStatus.textContent = `⚠️ Belum ada server cloud yang aktif. Klik 1-Click Deploy pada repository GitHub Anda.`;
        serverDot.classList.remove('connected');
      }
    });
  }

  presetTestConnectionBtn.addEventListener('click', async () => {
    let url = apiUrlInput.value.trim();
    if (!url) return;
    if (url.endsWith('/')) url = url.slice(0, -1);

    testConnectionStatus.style.color = 'var(--text-muted)';
    testConnectionStatus.textContent = '⏳ Menguji koneksi server...';

    try {
      const res = await fetch(`${url}/api/health`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        testConnectionStatus.style.color = '#34D399';
        testConnectionStatus.textContent = `✅ Server Cloud Online! (${data.developer || 'Ryukinnn'})`;
        serverDot.classList.add('connected');
      } else {
        testConnectionStatus.style.color = '#F87171';
        testConnectionStatus.textContent = `⚠️ Server HTTP ${res.status}. Membutuhkan 1-Click Deploy di Render / HuggingFace.`;
        serverDot.classList.remove('connected');
      }
    } catch (e) {
      testConnectionStatus.style.color = '#F87171';
      testConnectionStatus.textContent = '❌ Tidak dapat terhubung (Server Offline/404). Aktivasi Cloud Server 1-Click diperlukan.';
      serverDot.classList.remove('connected');
    }
  });

  btnSaveApi.addEventListener('click', () => {
    let url = apiUrlInput.value.trim();
    if (!url) url = CANDIDATE_ENDPOINTS[0];
    if (url.endsWith('/')) url = url.slice(0, -1);
    activeApiUrl = url;
    localStorage.setItem('velmire_api_url', activeApiUrl);
    serverModal.classList.add('hidden');
    checkServerHealth();
  });

  // Auto-Resolve Active Working Backend Endpoint
  async function resolveWorkingBackend() {
    try {
      const res = await fetch(`${activeApiUrl}/api/health`, { method: 'GET' });
      if (res.ok) return activeApiUrl;
    } catch (e) {}

    for (const ep of CANDIDATE_ENDPOINTS) {
      try {
        const res = await fetch(`${ep}/api/health`, { method: 'GET' });
        if (res.ok) {
          activeApiUrl = ep;
          localStorage.setItem('velmire_api_url', activeApiUrl);
          apiUrlInput.value = activeApiUrl;
          return activeApiUrl;
        }
      } catch (e) {}
    }
    return activeApiUrl;
  }

  // Check Health
  async function checkServerHealth() {
    try {
      const liveUrl = await resolveWorkingBackend();
      const res = await fetch(`${liveUrl}/api/health`, { method: 'GET' });
      if (res.ok) {
        serverDot.classList.add('connected');
      } else {
        serverDot.classList.remove('connected');
      }
    } catch (e) {
      serverDot.classList.remove('connected');
    }
  }
  checkServerHealth();

  // Create Clip Click Handler
  btnCreateClip.addEventListener('click', async () => {
    const ytUrl = ytUrlInput.value.trim();
    if (!ytUrl) {
      alert('Masukkan tautan video YouTube terlebih dahulu!');
      return;
    }

    const platform = platformSelect.value;
    const subLang = subLangSelect.value;
    const numClips = numClipsSelect.value;
    const subtitleStyle = subtitleStyleSelect.value;

    if (emptyPlaceholder) {
      emptyPlaceholder.style.display = 'none';
    }

    const clipId = 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const clipCard = document.createElement('div');
    clipCard.className = 'clip-card';
    clipCard.id = clipId;
    clipCard.innerHTML = `
      <div class="clip-media" id="media_${clipId}">
        <div style="padding: 40px; text-align: center; color: var(--text-muted);">
          <div class="spinner" style="font-size: 1.8rem; margin-bottom: 8px;">⏳</div>
          <div style="font-size: 0.9rem;">Menghubungkan ke Server Backend...</div>
        </div>
      </div>
      <div class="clip-info-row">
        <div class="clip-meta">${numClips} Klip · Sub: ${subLang.toUpperCase()} · 9:16</div>
        <div class="status-badge sending" id="badge_${clipId}">Menghubungkan</div>
      </div>
      <div id="action_${clipId}"></div>
    `;

    queueList.prepend(clipCard);

    try {
      const targetBackend = await resolveWorkingBackend();

      const response = await fetch(`${targetBackend}/api/clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: ytUrl,
          platform,
          numClips,
          subLang,
          subtitleStyle
        })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server Cloud belum aktif (404). Silakan lakukan 1-Click Deploy pada repository GitHub Anda.`);
      }

      const data = await response.json();
      if (!response.ok || !data.jobId) {
        throw new Error(data.error || 'Gagal memproses pemotongan video.');
      }

      pollJobStatus(data.jobId, clipId, targetBackend);
    } catch (err) {
      console.error(err);
      const badge = document.getElementById(`badge_${clipId}`);
      if (badge) {
        badge.className = 'status-badge error';
        badge.textContent = 'Gagal';
      }
      const media = document.getElementById(`media_${clipId}`);
      if (media) {
        media.innerHTML = `
          <div style="padding: 24px; color: #F87171; text-align: center; font-size: 0.88rem; line-height: 1.4;">
            <div style="font-weight: 700; margin-bottom: 6px;">Status Pemrosesan Video</div>
            ${err.message}
          </div>
        `;
      }
    }
  });

  // Poll Job Status Function
  function pollJobStatus(jobId, clipId, baseUrl) {
    const badge = document.getElementById(`badge_${clipId}`);
    const media = document.getElementById(`media_${clipId}`);
    const action = document.getElementById(`action_${clipId}`);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${baseUrl}/api/status/${jobId}`);
        const contentType = res.headers.get('content-type');
        if (!res.ok || !contentType || !contentType.includes('application/json')) return;

        const job = await res.json();

        if (badge) {
          badge.textContent = job.statusMessage || job.status;
          if (job.status === 'selesai') {
            badge.className = 'status-badge selesai';
          } else if (job.status === 'failed') {
            badge.className = 'status-badge error';
          } else {
            badge.className = 'status-badge rendering';
          }
        }

        if (job.status === 'selesai' && job.clips && job.clips.length > 0) {
          clearInterval(interval);

          const firstClipUrl = job.clips[0].url.startsWith('http') ? job.clips[0].url : `${baseUrl}${job.clips[0].url}`;

          if (media) {
            media.innerHTML = `
              <video src="${firstClipUrl}" controls playsinline preload="metadata"></video>
            `;
          }

          if (action) {
            let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
            job.clips.forEach((c, idx) => {
              const fullUrl = c.url.startsWith('http') ? c.url : `${baseUrl}${c.url}`;
              html += `
                <a href="${fullUrl}" download="velmire_clip_${jobId}_${idx+1}.mp4" class="btn-download" target="_blank">
                  <span>Unduh Video Potongan #${idx+1} (${c.timeLabel})</span>
                  <span>📥</span>
                </a>
              `;
            });
            html += '</div>';
            action.innerHTML = html;
          }
        } else if (job.status === 'failed') {
          clearInterval(interval);
          if (media) {
            media.innerHTML = `<div style="padding:20px; color:#F87171; text-align:center;">${job.error || 'Gagal memproses video.'}</div>`;
          }
        }
      } catch (e) {
        console.warn('Status poll error:', e);
      }
    }, 2000);
  }
});
