import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";
import { CATEGORY_MAP } from "./constants";
import { won } from "./format";
import type { Space } from "./types";

/**
 * 카톡·인스타 공유 카드(1200×630) 렌더러.
 *
 * - 한글이 깨지지 않도록 앱과 같은 둥근 글꼴(NanumSquareRound)의 TTF 를 직접 읽어 넣는다.
 *   (satori/ImageResponse 는 woff2 를 지원하지 않아 public/fonts 의 woff2 를 TTF 로 변환해 두었다)
 * - 사진은 원격 URL 을 그대로 넘기면 satori 가 직접 받아 오다 실패할 수 있어, 서버에서
 *   먼저 내려받아 data URI 로 넣는다(4.5MB 초과·실패 시 사진 없이 카테고리 그라데이션으로 대체).
 */

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

let fontCache: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> | null = null;

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
}

const SITE_ORIGIN = (process.env.SITE_URL ?? "https://igotjeogot.vercel.app").replace(/\/$/, "");

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

async function toDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!type.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > 4_500_000) return null;
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
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

export async function renderShareCard(input: ShareCardInput): Promise<ImageResponse> {
  const [fonts, photo] = await Promise.all([loadFonts(), toDataUrl(input.photoUrl)]);
  const category = CATEGORY_MAP[input.space.category] ?? CATEGORY_MAP.party;
  const [from, to] = GRADIENTS[input.space.category] ?? GRADIENTS.party;
  const area = [input.space.region, input.space.district].filter(Boolean).join(" ");
  const discounted = Math.round((input.space.pricePerHour * (100 - input.space.discountRate)) / 100);
  const isDeal = input.space.discountRate > 0;
  const titleLines = splitTitle(input.title);
  const longestLine = Math.max(...titleLines.map((line) => line.length));
  const titleSize = longestLine > 15 ? 48 : longestLine > 12 ? 56 : longestLine > 9 ? 64 : 74;

  return new ImageResponse(
    (
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
            <div style={{ display: "flex", fontSize: "22px", fontWeight: 800 }}>igotjeogot.vercel.app</div>
          </div>
          <div style={{ display: "flex", fontSize: "20px", color: "#A899A1" }}>
            카톡·인스타로 공유하면 사진과 가격이 그대로 보여요
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "NanumSquareRound", data: fonts.regular, weight: 400, style: "normal" },
        { name: "NanumSquareRound", data: fonts.bold, weight: 800, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
