/*
 * 이곳저곳 경량 서비스 워커
 *
 * 홈 화면에 추가한 앱(standalone)에서 아이콘 같은 정적 이미지만 캐시에서 즉시 응답한다.
 * HTML 문서, /api 요청, Supabase(외부 도메인) 실시간·인증 요청은 respondWith로 가로채지
 * 않으므로 항상 네트워크로 그대로 나간다 → 로그인/실시간 예약 흐름에 영향 없음.
 */
const CACHE_NAME = "placeon-static-v1";
const ICON_PREFIX = "/icons/";
const PRECACHE = [
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }

  // 외부 도메인(Supabase 등)과 아이콘 외 경로는 손대지 않고 네트워크로 통과시킨다.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(ICON_PREFIX)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
