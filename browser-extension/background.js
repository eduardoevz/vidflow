const detectedByTab = new Map();
const MEDIA_PATTERN = /\.(m3u8|mpd|mp4|webm|m4v)(\?|$)/i;

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const contentTypeHeader = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type',
    );
    const contentType = contentTypeHeader?.value?.toLowerCase() || '';
    const isMediaUrl = MEDIA_PATTERN.test(details.url);
    const isMediaMime =
      contentType.startsWith('video/') ||
      contentType.includes('mpegurl') ||
      contentType.includes('dash+xml');

    if (!isMediaUrl && !isMediaMime) return;
    if (details.url.endsWith('.ts') || details.url.endsWith('.m4s')) return;

    const list = detectedByTab.get(details.tabId) || [];
    if (!list.some((item) => item.url === details.url)) {
      list.unshift({ url: details.url, contentType, detectedAt: Date.now() });
      if (list.length > 25) list.pop();
      detectedByTab.set(details.tabId, list);
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders'],
);

chrome.tabs.onRemoved.addListener((tabId) => {
  detectedByTab.delete(tabId);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_DETECTED') {
    sendResponse({ items: detectedByTab.get(msg.tabId) || [] });
  }
});
