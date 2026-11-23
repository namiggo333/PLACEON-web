"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { CheckIcon, CopyIcon, LinkIcon, SparkleIcon } from "@/components/Icons";

/** QR 모듈 행렬을 그린다. size 는 캔버스 한 변(px), margin 은 조용 구역(모듈 수). */
function paintQr(
  canvas: HTMLCanvasElement,
  url: string,
  options: { size: number; margin?: number; dark?: string; light?: string } = { size: 220 }
) {
  const { size, margin = 4, dark = "#1B1624", light = "#FFFFFF" } = options;
  // URL 길이에 맞춰 버전을 자동 선택한다(오류정정 M).
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const total = count + margin * 2;
  const scale = Math.floor((size * dpr) / total) || 1;
  const pixels = total * scale;
  canvas.width = pixels;
  canvas.height = pixels;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, pixels, pixels);
  ctx.fillStyle = dark;
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
      }
    }
  }
  return { count, pixels };
}

/** 1080×1080 저장용 이미지 — 흰 배경, 공간명 + QR + 안내 문구 */
function buildShareImage(url: string, spaceName: string) {
  const canvas = document.createElement("canvas");
  const SIZE = 1080;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 상단 브랜드 띠
  ctx.fillStyle = "#FFF0F6";
  ctx.fillRect(0, 0, SIZE, 150);
  ctx.fillStyle = "#E01867";
  ctx.font = "700 44px Pretendard, Apple SD Gothic Neo, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("이곳저곳", SIZE / 2, 96);

  // 공간명
  ctx.fillStyle = "#1B1624";
  ctx.font = "800 56px Pretendard, Apple SD Gothic Neo, sans-serif";
  const title = spaceName.length > 18 ? `${spaceName.slice(0, 18)}…` : spaceName;
  ctx.fillText(title, SIZE / 2, 250);
  ctx.fillStyle = "#6F6879";
  ctx.font = "500 32px Pretendard, Apple SD Gothic Neo, sans-serif";
  ctx.fillText("예약은 QR로", SIZE / 2, 306);

  // QR (중앙 620px)
  const qrCanvas = document.createElement("canvas");
  paintQr(qrCanvas, url, { size: 620, margin: 3 });
  const qrSize = 620;
  ctx.drawImage(qrCanvas, (SIZE - qrSize) / 2, 360, qrSize, qrSize);

  // 하단 링크
  ctx.fillStyle = "#4F4757";
  ctx.font = "600 30px Pretendard, Apple SD Gothic Neo, sans-serif";
  const shortUrl = url.replace(/^https?:\/\//, "");
  ctx.fillText(shortUrl.length > 40 ? `${shortUrl.slice(0, 40)}…` : shortUrl, SIZE / 2, 1030);

  return canvas;
}

export function QrShare({
  url,
  spaceName,
  onToast,
}: {
  url: string;
  spaceName: string;
  onToast: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) {
      setReady(false);
      return;
    }
    try {
      paintQr(canvasRef.current, url, { size: 220 });
      setReady(true);
    } catch {
      setReady(false);
    }
  }, [url]);

  const shareText = useMemo(
    () => `${spaceName} 예약 링크예요 🩷\n${url}\n\n날짜와 시간을 고르면 바로 예약하실 수 있어요.`,
    [spaceName, url]
  );

  async function copyLink() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const area = document.createElement("textarea");
        area.value = url;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      onToast("결제 링크를 복사했어요!");
    } catch {
      onToast("복사가 차단됐어요. 링크를 길게 눌러 복사해 주세요.");
    }
  }

  async function share() {
    if (!url) return;
    setSharing(true);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `${spaceName} 예약 링크`, text: shareText, url });
        onToast("공유 창을 열었어요.");
      } else {
        await copyLink();
        onToast("이 브라우저는 공유 창이 없어 링크를 복사했어요.");
      }
    } catch (error) {
      // 사용자가 공유를 취소한 경우는 조용히 넘어간다.
      if (error instanceof Error && error.name !== "AbortError") {
        onToast("공유하지 못했어요. 링크 복사를 이용해 주세요.");
      }
    } finally {
      setSharing(false);
    }
  }

  async function saveQr() {
    if (!url) return;
    const canvas = buildShareImage(url, spaceName);
    if (!canvas) {
      onToast("QR 이미지를 만들지 못했어요.");
      return;
    }
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("blob");
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `이곳저곳-QR-${spaceName.replace(/[^\w가-힣-]+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(href), 4000);
      onToast("QR 이미지를 저장했어요. (1080×1080)");

      // 아이폰 사파리는 다운로드 대신 공유 시트가 자연스럽다.
      const file = new File([blob], "이곳저곳-QR.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `${spaceName} QR` });
      }
    } catch {
      onToast("QR 저장이 막혔어요. QR을 길게 눌러 저장해 주세요.");
    }
  }

  return (
    <div className="rounded-2xl border border-ink-line p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-extrabold text-ink">매장·인스타에 붙일 QR</p>
          <p className="mt-0.5 text-[12px] text-ink-mute">손님이 스캔하면 바로 예약 페이지로 열려요.</p>
        </div>
        <span className="ui-badge ui-badge--ok">
          <CheckIcon size={13} />
          무료
        </span>
      </div>

      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-xl border border-ink-line bg-white p-2">
          {url ? (
            <canvas ref={canvasRef} aria-label={`${spaceName} 예약 링크 QR 코드`} className={ready ? "" : "opacity-30"} />
          ) : (
            <div className="grid h-[220px] w-[220px] place-items-center text-[12px] text-ink-mute">
              공간을 먼저 등록해 주세요
            </div>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-ink-line/30 px-2.5 py-2">
            <LinkIcon size={13} className="shrink-0 text-brand-dark" />
            <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">{url || "링크 없음"}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={!url || sharing}
              onClick={() => void share()}
              className="flex h-12 items-center justify-center gap-1 rounded-xl bg-brand-dark px-2 text-[13px] font-bold text-white disabled:opacity-50"
            >
              <SparkleIcon size={14} />
              공유
            </button>
            <button
              type="button"
              disabled={!url}
              onClick={() => void copyLink()}
              className="flex h-12 items-center justify-center gap-1 rounded-xl border border-ink-line px-2 text-[13px] font-bold text-ink disabled:opacity-50"
            >
              <CopyIcon size={14} />
              복사
            </button>
            <button
              type="button"
              disabled={!url}
              onClick={() => void saveQr()}
              className="flex h-12 items-center justify-center gap-1 rounded-xl border border-ink-line px-2 text-[13px] font-bold text-ink disabled:opacity-50"
            >
              QR 저장
            </button>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-mute">
            아이폰에서 저장이 막히면 QR을 길게 눌러 이미지를 저장해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
