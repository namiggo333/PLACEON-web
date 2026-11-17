"use client";

import { useEffect } from "react";

/**
 * 홈 화면에 추가한 앱(PWA)에서 정적 아이콘 캐시를 쓰기 위한 서비스 워커 등록.
 * 개발 모드에서는 등록하지 않아 next dev의 핫리로드를 방해하지 않는다.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* 등록 실패는 앱 동작에 영향 없음 */
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
