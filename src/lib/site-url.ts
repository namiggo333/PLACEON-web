/**
 * 대표 주소(site URL).
 *
 * - 기본값은 대표 도메인 `https://igotjeogot.com`.
 * - `NEXT_PUBLIC_SITE_URL`(브라우저 번들에도 인라인됨) 또는 서버용 `SITE_URL` 이 있으면 그 값.
 * - 끝의 `/` 는 떼어 내고 `${SITE_URL}/path` 형태로 붙여 쓴다.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "https://igotjeogot.com"
).replace(/\/$/, "");

/** 도메인만 (`igotjeogot.com`) — 화면·이미지에 짧게 표기할 때 */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
