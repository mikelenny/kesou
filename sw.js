/* 可搜 Service Worker —— 离线缓存
 * 策略：
 *   - 应用外壳（HTML / manifest / 图标 / 依赖库）：安装时预缓存
 *   - 同源资源：缓存优先，后台更新
 *   - 页面导航：网络优先，断网时用缓存
 *   - CDN 兜底资源：stale-while-revalidate（首次联网后即可离线）
 */
const VERSION = 'kesou-v1.0.2';
const CORE_CACHE = 'kesou-core-' + VERSION;
const RUNTIME_CACHE = 'kesou-runtime-' + VERSION;

const CORE_ASSETS = [
  './可搜.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './lib/pdf.min.js',
  './lib/pdf.worker.min.js',
  './lib/jszip.min.js',
  './lib/xlsx.full.min.js',
  './lib/mammoth.browser.min.js'
];

/* 常用中日韩 CMap（PDF 中文字体需要） */
const CMAPS = [
  'Adobe-GB1-UCS2', 'Adobe-CNS1-UCS2', 'Adobe-Japan1-UCS2', 'Adobe-Korea1-UCS2',
  'UniGB-UCS2-H', 'UniGB-UCS2-V', 'UniGB-UTF16-H', 'UniGB-UTF16-V', 'UniGB-UTF8-H', 'UniGB-UTF8-V',
  'UniCNS-UCS2-H', 'UniCNS-UCS2-V', 'UniCNS-UTF16-H', 'UniCNS-UTF16-V', 'UniCNS-UTF8-H', 'UniCNS-UTF8-V',
  'UniJIS-UCS2-H', 'UniJIS-UCS2-V', 'UniJIS-UTF16-H', 'UniJIS-UTF16-V', 'UniJIS-UTF8-H', 'UniJIS-UTF8-V',
  'UniKS-UCS2-H', 'UniKS-UCS2-V', 'UniKS-UTF16-H', 'UniKS-UTF16-V', 'UniKS-UTF8-H', 'UniKS-UTF8-V'
].map(name => './lib/cmaps/' + name + '.bcmap');

const STANDARD_FONTS = [
  'FoxitDingbats.pfb', 'FoxitFixed.pfb', 'FoxitFixedBold.pfb', 'FoxitFixedBoldItalic.pfb',
  'FoxitFixedItalic.pfb', 'FoxitSerif.pfb', 'FoxitSerifBold.pfb', 'FoxitSerifBoldItalic.pfb',
  'FoxitSerifItalic.pfb', 'FoxitSymbol.pfb', 'LiberationSans-Bold.ttf',
  'LiberationSans-BoldItalic.ttf', 'LiberationSans-Italic.ttf', 'LiberationSans-Regular.ttf'
].map(name => './lib/standard_fonts/' + name);

const PRECACHE = CORE_ASSETS.concat(CMAPS, STANDARD_FONTS);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    // 逐个添加：个别文件缺失不影响整体安装
    await Promise.all(PRECACHE.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => {
      if (key !== CORE_CACHE && key !== RUNTIME_CACHE) return caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CORE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const shell = await caches.match('./可搜.html');
    if (shell) return shell;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://')) return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CORE_CACHE));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
