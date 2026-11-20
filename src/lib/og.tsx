import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { CATEGORY_MAP } from "./constants";
import { won } from "./format";
import type { Space } from "./types";
import { SITE_HOST, SITE_URL } from "./site-url";

/**
 * 카톡·인스타 공유 카드(1200×630) 렌더러.
 *
 * - 한글이 깨지지 않도록 앱과 같은 둥근 글꼴(NanumSquareRound)의 TTF 를 직접 읽어 넣는다.
 *   (satori/ImageResponse 는 woff2 를 지원하지 않아 public/fonts 의 woff2 를 TTF 로 변환해 두었다)
 * - 사진은 원격 URL 을 그대로 넘기면 satori 가 직접 받아 오다 실패할 수 있어, 서버에서
 *   먼저 내려받아 data URI 로 넣는다(실패 시 사진 없이 카테고리 그라데이션으로 대체).
 * - satori(resvg)는 PNG·JPEG 만 디코드한다. WebP·AVIF 로 저장된 사진을 그대로 넣으면 카드 전체가
 *   500 이 되므로(예: SayParty 공간 사진), sharp 로 430×430 PNG 로 변환해 넣는다.
 * - 렌더는 본문을 읽을 때 일어나므로 여기서 미리 버퍼로 만들어, 사진 때문에 실패하면
 *   사진을 뺀 기본 카드로 다시 그린다(500 대신 정상 카드).
 */

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

let fontCache: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> | null = null;

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
}

const SITE_ORIGIN = SITE_URL;

/** 폰트 파일을 읽는다. 서버리스 번들에 파일이 빠졌을 때를 대비해 공개 URL 로 한 번 더 시도한다. */
async function readFont(fileName: string): Promise<ArrayBuffer> {
  try {
    return toArrayBuffer(await fs.promises.readFile(path.join(FONT_DIR, fileName)));
  } catch (error) {
    console.warn("[og] 폰트 파일을 찾지 못해 공개 URL 로 불러옵니다.", fileName, error);
    const response = await fetch(`${SITE_ORIGIN}/fonts/${fileName}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`폰트를 불러오지 못했어요: ${fileName}`);
    return response.arrayBuffer();
  }
}

function loadFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (!fontCache) {
    fontCache = Promise.all([readFont("NanumSquareRoundB.ttf"), readFont("NanumSquareRoundEB.ttf")]).then(
      ([regular, bold]) => ({ regular, bold })
    );
  }
  return fontCache;
}

/** 긴 공간 이름을 두 줄로 나눈다 — 단어 중간에서 끊기지 않도록 */
function splitTitle(title: string): string[] {
  const clean = title.trim();
  if (clean.length <= 10) return [clean];
  const words = clean.split(/\s+/);
  if (words.length === 1) return [clean];
  let bestIndex = 1;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(" ");
    const right = words.slice(index).join(" ");
    const diff = Math.abs(left.length - right.length);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  }
  return [words.slice(0, bestIndex).join(" "), words.slice(bestIndex).join(" ")];
}

const PHOTO_BOX = 430; // 카드 오른쪽 사진 영역(px)
const MAX_INLINE_BYTES = 4_500_000; // PNG·JPEG 를 그대로 넣을 때의 상한
const MAX_SOURCE_BYTES = 20_000_000; // 변환 전 원본 상한

/** 매직 바이트로 실제 포맷을 본다 — 스토리지가 content-type 을 잘못 줘도 대비 */
function sniffFormat(buffer: Buffer): string | null {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("latin1"))) return "gif";
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("latin1");
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "avif";
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("mif1")) return "heif";
  }
  return null;
}

/** 어떤 포맷이든 satori 가 읽는 430×430 PNG data URI 로 만든다. */
async function toPngDataUrl(buffer: Buffer): Promise<string> {
  const png = await sharp(buffer, { failOn: "none", limitInputPixels: 60_000_000, animated: false })
    .rotate() // EXIF 회전 반영
    .resize(PHOTO_BOX, PHOTO_BOX, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function toDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const declared = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (declared && !declared.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0) return null;
    const format = sniffFormat(buffer) ?? (declared ? declared.replace("image/", "") : null);

    // resvg 가 그대로 읽는 PNG·JPEG 는 원본을 쓴다(가장 빠르고 화질 손실 없음).
    if ((format === "png" || format === "jpeg") && buffer.byteLength <= MAX_INLINE_BYTES) {
      const mime = format === "png" ? "image/png" : "image/jpeg";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }

    // WebP·AVIF·GIF·HEIC 등은 resvg 가 디코드하지 못한다 — sharp 로 PNG 변환.
    if (buffer.byteLength > MAX_SOURCE_BYTES) return null;
    return await toPngDataUrl(buffer);
  } catch (error) {
    console.warn(
      "[og] 대표 사진을 준비하지 못해 사진 없이 그립니다",
      url,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

const GRADIENTS: Record<string, [string, string]> = {
  party: ["#FFD9E4", "#FF9DBB"],
  kidsroom: ["#FFF0C2", "#FFC97A"],
  practice: ["#E7E0FF", "#BFA9FF"],
  studio: ["#DCEFFF", "#9FCBFF"],
  meeting: ["#DDF3E9", "#9ED9C6"],
  kitchen: ["#FFE3E9", "#FFB9C8"],
  rooftop: ["#FFE3DC", "#FFAE9C"],
  study: ["#E8ECF3", "#BFC7D6"],
};

export interface ShareCardInput {
  title: string;
  photoUrl: string | null;
  space: Pick<Space, "category" | "region" | "district" | "pricePerHour" | "discountRate" | "capacity">;
  /** 결제 링크 카드면 "로그인 없이 3초 예약" 문구를 넣는다 */
  kind: "space" | "pay";
}

function buildCardElement(input: ShareCardInput, photo: string | null) {
  const category = CATEGORY_MAP[input.space.category] ?? CATEGORY_MAP.party;
  const [from, to] = GRADIENTS[input.space.category] ?? GRADIENTS.party;
  const area = [input.space.region, input.space.district].filter(Boolean).join(" ");
  const discounted = Math.round((input.space.pricePerHour * (100 - input.space.discountRate)) / 100);
  const isDeal = input.space.discountRate > 0;
  const titleLines = splitTitle(input.title);
  const longestLine = Math.max(...titleLines.map((line) => line.length));
  const titleSize = longestLine > 15 ? 48 : longestLine > 12 ? 56 : longestLine > 9 ? 64 : 74;

  return (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          position: "relative",
          fontFamily: "NanumSquareRound",
          color: "#1B1624",
        }}
      >
        {/* 브랜드 상단 띠 */}
        <div style={{ width: "1200px", height: "10px", display: "flex", background: "#FF2E7E" }} />

        <div style={{ display: "flex", flex: 1, padding: "46px 56px 30px 56px" }}>
          {/* 왼쪽: 텍스트 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              flex: 1,
              paddingRight: "34px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#FF2E7E",
                    color: "#FFFFFF",
                    borderRadius: "999px",
                    padding: "8px 18px",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  <span>이곳저곳</span>
                  <span style={{ fontSize: "16px", opacity: 0.85 }}>SPACE PLATFORM</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "#FFF0F6",
                    color: "#E01B6B",
                    borderRadius: "999px",
                    padding: "8px 16px",
                    fontSize: "20px",
                    fontWeight: 800,
                  }}
                >
                  {category.emoji} {category.label}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "30px",
                  maxWidth: "640px",
                }}
              >
                {titleLines.map((line, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      fontSize: titleSize,
                      fontWeight: 800,
                      lineHeight: 1.14,
                      letterSpacing: "-1.5px",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: "16px",
                  fontSize: "28px",
                  fontWeight: 400,
                  color: "#6B5F69",
                  maxWidth: "640px",
                }}
              >
                {area} · {input.space.capacity}명까지
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {isDeal ? (
                <div style={{ display: "flex", fontSize: "22px", fontWeight: 800, color: "#E01B6B" }}>
                  타임특가 {input.space.discountRate}% 할인
                </div>
              ) : null}
              <div style={{ display: "flex", alignItems: "baseline", marginTop: isDeal ? "6px" : "0px" }}>
                <div style={{ display: "flex", fontSize: "52px", fontWeight: 800, color: "#FF2E7E" }}>
                  {won(isDeal ? discounted : input.space.pricePerHour)}
                </div>
                <div style={{ display: "flex", marginLeft: "10px", fontSize: "24px", fontWeight: 400, color: "#8A7C86" }}>
                  / 시간
                </div>
              </div>
              <div style={{ display: "flex", marginTop: "8px", fontSize: "20px", color: "#A899A1" }}>
                {(isDeal ? `정가 ${won(input.space.pricePerHour)} · ` : "") +
                  (input.kind === "pay"
                    ? "로그인 없이 3초 예약 · 입금 안내까지 한 번에"
                    : "시간 단위로 예약 · 이곳저곳에서 한 번에")}
              </div>
            </div>
          </div>

          {/* 오른쪽: 대표 사진 또는 카테고리 카드 */}
          <div
            style={{
              display: "flex",
              width: "430px",
              height: "430px",
              borderRadius: "34px",
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" width={430} height={430} style={{ objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", fontSize: "170px" }}>{category.emoji}</div>
            )}
          </div>
        </div>

        {/* 하단 브랜드 라인 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 56px 26px 56px",
            borderTop: "2px solid #F4E6EE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                borderRadius: "999px",
                background: "#FF2E7E",
                color: "#FFFFFF",
                fontSize: "18px",
                fontWeight: 800,
              }}
            >
              이곳
            </div>
            <div style={{ display: "flex", fontSize: "22px", fontWeight: 800 }}>{SITE_HOST}</div>
          </div>
          <div style={{ display: "flex", fontSize: "20px", color: "#A899A1" }}>
            카톡·인스타로 공유하면 사진과 가격이 그대로 보여요
          </div>
        </div>
      </div>
  );
}

const CARD_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

/** 카드를 실제로 그려 PNG 응답으로 만든다. 렌더 오류가 반드시 여기서 던져져야 대체 카드로 넘어갈 수 있다. */
async function renderCard(input: ShareCardInput, photo: string | null): Promise<Response> {
  const fonts = await loadFonts();
  const image = new ImageResponse(buildCardElement(input, photo), {
    width: 1200,
    height: 630,
    fonts: [
      { name: "NanumSquareRound", data: fonts.regular, weight: 400, style: "normal" },
      { name: "NanumSquareRound", data: fonts.bold, weight: 800, style: "normal" },
    ],
    headers: CARD_HEADERS,
  });
  // ImageResponse 는 본문을 읽을 때 satori/resvg 로 실제 렌더한다 — 여기서 오류를 잡아야 500 을 막는다.
  const png = await image.arrayBuffer();
  return new Response(png, { status: 200, headers: { ...CARD_HEADERS, "Content-Type": "image/png" } });
}

/**
 * 공유 카드(1200×630 PNG) 응답.
 * 사진을 넣은 렌더가 실패하면(미지원 포맷·손상 파일·시간 초과 등) 사진 없이 한 번 더 그린다.
 */
export async function renderShareCard(input: ShareCardInput): Promise<Response> {
  const photo = await toDataUrl(input.photoUrl);
  try {
    return await renderCard(input, photo);
  } catch (error) {
    console.error("[og] 사진을 넣은 공유 카드 렌더 실패 — 사진 없이 다시 그립니다", error);
    try {
      return await renderCard(input, null);
    } catch (fallbackError) {
      console.error("[og] 공유 카드 렌더 실패", fallbackError);
      return new Response("공유 카드를 만들지 못했어요", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }
}
