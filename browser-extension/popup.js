const BRIDGE_URL = 'http://127.0.0.1:47832';
const tokenInput = document.getElementById('tokenInput');
const saveTokenBtn = document.getElementById('saveTokenBtn');
const sendPageBtn = document.getElementById('sendPageBtn');
const streamsList = document.getElementById('streamsList');
const statusEl = document.getElementById('status');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#f87171' : '#34d399';
}

async function getToken() {
  const data = await chrome.storage.local.get(['vidflowToken']);
  return data.vidflowToken || '';
}

async function sendToVidFlow(url, pageUrl, title) {
  const token = await getToken();
  if (!token) {
    setStatus('Configura el token de VidFlow primero (Ajustes).', true);
    return;
  }
  try {
    const res = await fetch(`${BRIDGE_URL}/api/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VidFlow-Token': token,
      },
      body: JSON.stringify({ url, pageUrl, title, referer: pageUrl }),
    });
    if (!res.ok) {
      setStatus(res.status === 401 ? 'Token inválido.' : `Error (${res.status})`, true);
      return;
    }
    setStatus('Enviado a VidFlow.');
  } catch {
    setStatus('No se pudo conectar con VidFlow. ¿Está abierta la app?', true);
  }
}

async function init() {
  tokenInput.value = await getToken();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  sendPageBtn.addEventListener('click', () => {
    if (tab.url) void sendToVidFlow(tab.url, tab.url, tab.title);
  });

  chrome.runtime.sendMessage({ type: 'GET_DETECTED', tabId: tab.id }, (resp) => {
    const items = resp?.items || [];
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'item';
      const label = document.createElement('span');
      label.className = 'url';
      label.textContent = item.url;
      const btn = document.createElement('button');
      btn.textContent = 'Enviar';
      btn.addEventListener('click', () => void sendToVidFlow(item.url, tab.url, tab.title));
      row.appendChild(label);
      row.appendChild(btn);
      streamsList.appendChild(row);
    }
  });
}

saveTokenBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ vidflowToken: tokenInput.value.trim() });
  setStatus('Token guardado.');
});

void init();
