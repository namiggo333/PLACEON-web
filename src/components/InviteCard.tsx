"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon, CheckIcon, ClockIcon, CloseIcon, CopyIcon, PinIcon, UsersIcon } from "./Icons";
import { LogoMark } from "./Logo";
import { cn, formatDate, timeRange } from "@/lib/format";
import type { Booking, Space } from "@/lib/types";

const BRAND = "#FF2E7E";
const INK = "#1B1624";
const INK_MUTE = "#8E8798";
const LINE = "#F1E4EC";

/** 초대 문구 — 카톡·인스타 DM에 바로 붙여 넣을 수 있는 텍스트 */
export function inviteMessage(booking: Booking, space?: Space | null): string {
  const place = space?.address?.trim() || `${space?.region ?? ""} ${space?.district ?? ""}`.trim();
  const lines = [
    "💌 모임 초대장",
    "",
    booking.spaceName,
    `🗓 ${formatDate(booking.date)} ${timeRange(booking.startTime, booking.hours)}`,
    `👥 ${booking.guests}명 · ${booking.hours}시간`,
  ];
  if (place) lines.push(`📍 ${place}`);
  lines.push(
    "",
    `${booking.guestName} 님이 이곳저곳에서 예약한 모임이에요.`,
    "이곳저곳에서 예약한 모임 · igotjeogot.vercel.app"
  );
  return lines.join("\n");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.quadraticCurveTo(cx + size * 0.16, cy - size * 0.16, cx + size, cy);
  ctx.quadraticCurveTo(cx + size * 0.16, cy + size * 0.16, cx, cy + size);
  ctx.quadraticCurveTo(cx - size * 0.16, cy + size * 0.16, cx - size, cy);
  ctx.quadraticCurveTo(cx - size * 0.16, cy - size * 0.16, cx, cy - size);
  ctx.fill();
  ctx.restore();
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const top = cy - size * 0.3;
  ctx.moveTo(cx, cy + size * 0.72);
  ctx.bezierCurveTo(cx - size * 1.15, cy - size * 0.1, cx - size * 0.5, top - size * 0.75, cx, top - size * 0.05);
  ctx.bezierCurveTo(cx + size * 0.5, top - size * 0.75, cx + size * 1.15, cy - size * 0.1, cx, cy + size * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  let out = text;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) out = out.slice(0, -1);
  return out === text ? text : `${out.trimEnd()}…`;
}

/** 카드 이미지(1080×1350, 인스타 4:5)를 캔버스로 그린다 — 저장·공유에 그대로 사용 */
async function drawInviteCard(booking: Booking, space: Space | null | undefined): Promise<HTMLCanvasElement> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서는 카드 이미지를 만들 수 없어요.");

  const place =
    space?.address?.trim() ||
    `${space?.region ?? ""} ${space?.district ?? ""}`.trim() ||
    "장소는 사장님께 문의해 주세요";
  const timeText = timeRange(booking.startTime, booking.hours);
  const jua = '"Jua", "NanumSquareRound", sans-serif';
  const round = '"NanumSquareRound", "Apple SD Gothic Neo", sans-serif';

  try {
    await Promise.all([
      document.fonts.load('400 60px Jua', `${booking.spaceName}모임초대장날짜시간인원장소이곳저곳에서예약한`),
      document.fonts.load('400 30px NanumSquareRound', `${place}${booking.guestName}`),
      document.fonts.load('700 30px NanumSquareRound', `${place}${booking.guestName}`),
    ]);
  } catch {
    /* 폰트 로딩이 실패해도 기본 폰트로 계속 그린다 */
  }

  const mascot = new Image();
  mascot.src = "/images/mascot-wave.webp";
  try {
    await mascot.decode();
  } catch {
    /* 이미지가 없으면 원형 배경만 남긴다 */
  }

  // 배경
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#FFF0F6");
  bg.addColorStop(0.55, "#FFE9F1");
  bg.addColorStop(1, "#FFDCEA");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const blobs: [number, number, number, string][] = [
    [110, 130, 180, "rgba(255,255,255,0.7)"],
    [970, 250, 150, "rgba(255,46,126,0.10)"],
    [80, 1190, 160, "rgba(255,46,126,0.08)"],
    [1010, 1130, 210, "rgba(255,255,255,0.55)"],
  ];
  for (const [x, y, r, color] of blobs) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  sparkle(ctx, 170, 270, 24, "rgba(255,46,126,0.5)");
  sparkle(ctx, 912, 196, 17, "rgba(255,46,126,0.42)");
  sparkle(ctx, 946, 1206, 21, "rgba(255,46,126,0.32)");
  sparkle(ctx, 132, 1074, 14, "rgba(255,46,126,0.32)");

  // 초대장 카드
  const cardX = 56;
  const cardY = 78;
  const cardW = W - cardX * 2;
  const cardH = 1194;
  ctx.save();
  ctx.shadowColor = "rgba(184,13,84,0.18)";
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, cardX, cardY, cardW, cardH, 74);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();

  // 카드 상단 연분홍 헤더 (물결 경계)
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 74);
  ctx.clip();
  const headGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 440);
  headGrad.addColorStop(0, "#FFF4F9");
  headGrad.addColorStop(1, "#FFDEEB");
  ctx.fillStyle = headGrad;
  ctx.fillRect(cardX, cardY, cardW, 450);
  ctx.beginPath();
  ctx.moveTo(cardX, cardY + 392);
  ctx.bezierCurveTo(cardX + 250, cardY + 340, cardX + 560, cardY + 448, cardX + cardW, cardY + 372);
  ctx.lineTo(cardX + cardW, cardY + 470);
  ctx.lineTo(cardX, cardY + 470);
  ctx.closePath();
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();

  // 배지: 💌 대신 직접 그린 하트 + 글씨
  const badgeH = 56;
  const badgeY = cardY + 54;
  ctx.save();
  ctx.font = `400 30px ${jua}`;
  const badgeLabel = "모임 초대장";
  const badgeW = ctx.measureText(badgeLabel).width + 108;
  const badgeX = (W - badgeW) / 2;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = "#FFE4EF";
  ctx.fill();
  heart(ctx, badgeX + 42, badgeY + badgeH / 2, 13, BRAND);
  ctx.fillStyle = BRAND;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `400 30px ${jua}`;
  ctx.fillText(badgeLabel, badgeX + 68, badgeY + badgeH / 2 + 1);
  ctx.restore();

  // 마스코트
  const mcX = W / 2;
  const mcY = badgeY + badgeH + 150;
  const mcR = 118;
  ctx.save();
  ctx.beginPath();
  ctx.arc(mcX, mcY, mcR + 10, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mcX, mcY, mcR, 0, Math.PI * 2);
  ctx.clip();
  if (mascot.complete && mascot.naturalWidth > 0) {
    const size = mcR * 2;
    ctx.drawImage(mascot, mcX - mcR, mcY - mcR, size, size);
  } else {
    ctx.fillStyle = "#FFE4EF";
    ctx.fillRect(mcX - mcR, mcY - mcR, mcR * 2, mcR * 2);
  }
  ctx.restore();

  // 공간 이름 (중앙, 최대 2줄)
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `400 62px ${jua}`;
  const maxNameW = 760;
  let nameLines: string[] = [booking.spaceName];
  if (ctx.measureText(booking.spaceName).width > maxNameW) {
    const words = booking.spaceName.split(" ");
    if (words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      nameLines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    } else {
      nameLines = [booking.spaceName.slice(0, Math.ceil(booking.spaceName.length / 2)), booking.spaceName.slice(Math.ceil(booking.spaceName.length / 2))];
    }
    nameLines = nameLines.map((line) => {
      ctx.font = `400 62px ${jua}`;
      return fitText(ctx, line, maxNameW);
    });
  }
  const nameTop = mcY + mcR + 74;
  nameLines.forEach((line, i) => {
    ctx.font = `400 62px ${jua}`;
    ctx.fillText(line, W / 2, nameTop + i * 72);
  });

  const afterName = nameTop + (nameLines.length - 1) * 72;
  ctx.font = `700 27px ${round}`;
  ctx.fillStyle = INK_MUTE;
  ctx.fillText("이곳저곳에서 예약한 모임", W / 2, afterName + 52);

  // 정보 패널
  const panelX = cardX + 84;
  const panelY = afterName + 92;
  const panelW = cardW - 168;
  const rows: { label: string; value: string }[] = [
    { label: "날짜", value: formatDate(booking.date) },
    { label: "시간", value: timeText },
    { label: "인원", value: `${booking.guests}명 · ${booking.hours}시간` },
    { label: "장소", value: place },
  ];
  const rowH = 84;
  const panelH = rowH * rows.length + 44;
  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, 40);
  ctx.fillStyle = "#FFF8FB";
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  rows.forEach((row, i) => {
    const baseY = panelY + 22 + rowH * i + rowH / 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 26px ${round}`;
    ctx.fillStyle = INK_MUTE;
    ctx.fillText(row.label, panelX + 40, baseY);

    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    const valueMax = panelW - 210;
    ctx.font = `400 31px ${jua}`;
    ctx.fillText(fitText(ctx, row.value, valueMax), panelX + panelW - 40, baseY + 1);

    if (i < rows.length - 1) {
      ctx.save();
      ctx.strokeStyle = "#F7E9F0";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(panelX + 34, panelY + 22 + rowH * (i + 1));
      ctx.lineTo(panelX + panelW - 34, panelY + 22 + rowH * (i + 1));
      ctx.stroke();
      ctx.restore();
    }
  });

  // 초대하는 사람
  const hostY = panelY + panelH + 78;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 40px ${jua}`;
  ctx.fillStyle = BRAND;
  const hostLine = fitText(ctx, `${booking.guestName} 님이 초대합니다`, cardW - 180);
  ctx.fillText(hostLine, W / 2, hostY);

  ctx.font = `400 24px ${round}`;
  ctx.fillStyle = INK_MUTE;
  ctx.fillText("함께 모이는 날, 즐거운 시간 보내세요!", W / 2, hostY + 44);

  // 브랜드 푸터 — 마크 + 워드마크 + 주소를 한 줄에 가운데 정렬
  const footY = cardY + cardH - 74;
  const markSize = 40;
  ctx.font = `400 30px ${jua}`;
  const brandW = ctx.measureText("이곳저곳").width;
  ctx.font = `400 22px ${round}`;
  const domainW = ctx.measureText("igotjeogot.vercel.app").width;
  const gap1 = 10;
  const gap2 = 16;
  const totalW = markSize + gap1 + brandW + gap2 + domainW;
  const startX = (W - totalW) / 2;

  ctx.save();
  ctx.translate(startX, footY - markSize * 0.72);
  ctx.scale((markSize / 64), (markSize / 64));
  drawLogoMark(ctx);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 30px ${jua}`;
  ctx.fillStyle = INK;
  ctx.fillText("이곳저곳", startX + markSize + gap1, footY);
  ctx.font = `400 22px ${round}`;
  ctx.fillStyle = INK_MUTE;
  ctx.fillText("igotjeogot.vercel.app", startX + markSize + gap1 + brandW + gap2, footY);

  return canvas;
}

/** 로고 마크(지도 핀 + 하우스)를 64×64 좌표계로 그린다 */
function drawLogoMark(ctx: CanvasRenderingContext2D) {
  const pin = new Path2D(
    "M32 4.2C19.9 4.2 10.1 14 10.1 26.1c0 6.7 3.4 13 8.5 18.7 4.6 5.1 9.8 8.9 12.7 11.1.4.3 1 .3 1.4 0 2.9-2.2 8.1-6 12.7-11.1 5.1-5.7 8.5-12 8.5-18.7C53.9 14 44.1 4.2 32 4.2Z"
  );
  const house = new Path2D(
    "M32 18.6c.36 0 .71.14.98.4l10.4 9.5c.3.27.47.66.47 1.06v10.9c0 1.5-1.22 2.72-2.72 2.72H21.87a2.72 2.72 0 0 1-2.72-2.72V29.56c0-.4.17-.79.47-1.06l10.4-9.5c.27-.26.62-.4.98-.4Z"
  );
  const door = new Path2D("M28.3 43.2v-6.1a3.7 3.7 0 0 1 7.4 0v6.1h-7.4Z");
  ctx.fillStyle = BRAND;
  ctx.fill(pin);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill(house);
  ctx.fillStyle = "#F01D71";
  ctx.fill(door);
}

async function canvasToFile(canvas: HTMLCanvasElement): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("카드 이미지를 저장하지 못했어요.");
  return new File([blob], "이곳저곳-모임-초대카드.png", { type: "image/png" });
}

/** 예약 확정 건의 '모임 초대 카드' 모달 */
export function InviteCardModal({
  booking,
  space,
  open,
  onClose,
}: {
  booking: Booking;
  space?: Space | null;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<null | "save" | "share">(null);
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const place = useMemo(
    () =>
      space?.address?.trim() || `${space?.region ?? ""} ${space?.district ?? ""}`.trim() || "장소는 사장님께 문의",
    [space]
  );
  const timeText = timeRange(booking.startTime, booking.hours);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setStatus("");
      setPreview(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const copyText = useCallback(async () => {
    const text = inviteMessage(booking, space);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    setStatus("초대 문구를 복사했어요. 카톡·인스타에 붙여 넣어 보세요!");
    window.setTimeout(() => setCopied(false), 2200);
  }, [booking, space]);

  const ensureCanvas = useCallback(async () => {
    if (!canvasRef.current) canvasRef.current = await drawInviteCard(booking, space);
    return canvasRef.current;
  }, [booking, space]);

  const saveImage = useCallback(async () => {
    setBusy("save");
    setStatus("");
    try {
      const canvas = await ensureCanvas();
      const file = await canvasToFile(canvas);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus("초대 카드 이미지를 저장했어요. 사진첩에서 확인해 보세요.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "카드 이미지를 저장하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }, [ensureCanvas]);

  const shareCard = useCallback(async () => {
    setBusy("share");
    setStatus("");
    try {
      const canvas = await ensureCanvas();
      const file = await canvasToFile(canvas);
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      const data: ShareData = { files: [file], title: `${booking.spaceName} 모임 초대장`, text: inviteMessage(booking, space) };
      if (nav.share && (!nav.canShare || nav.canShare(data))) {
        await nav.share(data);
        setStatus("공유 창을 열었어요.");
      } else {
        setPreview(canvas.toDataURL("image/png"));
        setStatus("이 브라우저는 이미지 공유를 지원하지 않아요. 아래 이미지를 길게 눌러 저장해 주세요.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("");
      } else {
        setStatus(error instanceof Error ? error.message : "공유하지 못했어요.");
      }
    } finally {
      setBusy(null);
    }
  }, [booking, ensureCanvas, space]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="모임 초대 카드"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="animate-pop-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-xl3 bg-white p-4 shadow-float sm:rounded-xl3 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-ink">
            <span className="font-display text-base text-brand">모임 초대 카드</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-mute transition hover:bg-ink-line/60 hover:text-ink"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* 초대장 카드 (화면용) */}
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#FFF0F6] via-[#FFE9F1] to-[#FFDCEA] p-3.5 shadow-card ring-1 ring-white/70"
        >
          <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/60" aria-hidden />
          <span className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-brand/10" aria-hidden />

          <div className="relative flex flex-col items-center rounded-[20px] bg-white px-4 pb-4 pt-4 shadow-sm">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-[20px] bg-gradient-to-b from-[#FFF4F9] to-white" aria-hidden />
            <span className="relative inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11.5px] font-bold text-brand">
              <span aria-hidden>💌</span> 모임 초대장
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mascot-wave.webp"
              alt="이곳저곳 마스코트"
              className="relative mt-2.5 h-20 w-20 rounded-full bg-brand-light object-cover ring-4 ring-white"
            />
            <h3 className="relative mt-2.5 text-center text-[20px] leading-snug text-ink">{booking.spaceName}</h3>
            <p className="relative mt-1 text-[10.5px] font-bold text-ink-mute">이곳저곳에서 예약한 모임</p>

            <dl className="relative mt-3 w-full space-y-1.5 rounded-2xl bg-[#FFF8FB] p-3 ring-1 ring-ink-line">
              {[
                { icon: <CalendarIcon size={13} />, label: "날짜", value: formatDate(booking.date) },
                { icon: <ClockIcon size={13} />, label: "시간", value: timeText },
                { icon: <UsersIcon size={13} />, label: "인원", value: `${booking.guests}명 · ${booking.hours}시간` },
                { icon: <PinIcon size={13} />, label: "장소", value: place },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-2.5">
                  <dt className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-bold text-ink-mute">
                    {row.icon}
                    {row.label}
                  </dt>
                  <dd className="min-w-0 text-right text-[12px] font-bold leading-snug text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>

            <p className="relative mt-3 text-center text-[13px] text-brand">{booking.guestName} 님이 초대합니다</p>
            <p className="relative mt-0.5 text-center text-[10px] text-ink-mute">함께 모이는 날, 즐거운 시간 보내세요!</p>

            <div className="relative mt-3 flex w-full items-center justify-center gap-1.5 border-t border-dashed border-ink-line pt-2.5">
              <LogoMark size={18} shadow={false} decorative />
              <span className="text-[12px] text-ink">이곳저곳</span>
              <span className="text-[9px] text-ink-mute">igotjeogot.vercel.app</span>
            </div>
          </div>
        </div>

        {status && (
          <p className="mt-2.5 animate-fade-up rounded-xl bg-brand-light px-3 py-2 text-[11px] font-semibold leading-relaxed text-brand-deep">
            {status}
          </p>
        )}

        {preview && (
          <div className="mt-2.5 rounded-xl border border-ink-line p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="저장할 초대 카드 이미지" className="w-full rounded-lg" />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={copyText} className={cn("btn-ghost btn-sm py-2.5", copied && "border-brand text-brand")}>
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            {copied ? "복사했어요" : "초대 문구 복사"}
          </button>
          <button type="button" onClick={saveImage} disabled={busy !== null} className="btn-soft btn-sm py-2.5">
            {busy === "save" ? "만드는 중…" : "카드 이미지 저장"}
          </button>
          <button type="button" onClick={shareCard} disabled={busy !== null} className="btn-primary col-span-2 py-3">
            {busy === "share" ? "공유 준비 중…" : "카드로 공유하기"}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-ink-mute">
          이미지는 1080×1350(인스타 4:5) 크기로 저장돼요.
        </p>
      </div>
    </div>
  );
}
