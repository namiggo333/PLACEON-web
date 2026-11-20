import { createClient } from "@supabase/supabase-js";
import type { BookingRow } from "./mappers";
import { SITE_URL } from "./site-url";

/**
 * 사장님 예약 알림 메일.
 *
 * - 무료 범위에서 실제 발송되는 수단을 쓴다: Resend(우선) 또는 Brevo.
 *   `RESEND_API_KEY` 가 있으면 Resend, 없고 `BREVO_API_KEY` 가 있으면 Brevo 로 보낸다.
 * - 발송 실패가 예약 API 응답을 실패시키지 않도록 모든 오류를 삼키고 결과만 돌려준다.
 * - Resend 무료 플랜에서 도메인을 인증하지 않으면 `onboarding@resend.dev` 로는
 *   계정 소유자 주소로만 보낼 수 있다. 도메인 인증 후 `MAIL_FROM` 을 바꾸면
 *   모든 사장님 주소로 발송할 수 있다.
 */

export type BookingNoticeKind = "created" | "confirmed" | "cancelled";

export interface MailResult {
  sent: boolean;
  provider?: "resend" | "brevo";
  skipped?: string;
  error?: string;
}

const HOST_PAGE_URL = `${SITE_URL}/host`;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function won(value: number): string {
  return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`;
}

/** "2026-12-20" + "18:00" → "12월 20일 (일) 오후 6:00" */
function formatSlot(date: string, startTime: string): string {
  const [y, m, d] = (date ?? "").split("-").map(Number);
  const [hh, mm] = (startTime ?? "").split(":").map(Number);
  if (!y || !m || !d) return `${date} ${startTime}`;
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
  const period = hh < 12 ? "오전" : "오후";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${m}월 ${d}일 (${weekday}) ${period} ${hour12}:${String(Number.isFinite(mm) ? mm : 0).padStart(2, "0")}`;
}

function endTime(startTime: string, hours: number): string {
  const [h] = (startTime ?? "").split(":").map(Number);
  const end = Math.min((Number.isFinite(h) ? h : 0) + (Number(hours) || 0), 24);
  return `${String(end).padStart(2, "0")}:00`;
}

/** timestamptz → "11월 18일 (화) 오후 7:12" (Asia/Seoul) */
function formatKstDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const period = get("dayPeriod") || (date.getUTCHours() + 9 >= 12 ? "오후" : "오전");
  return `${get("month")}월 ${get("day")}일 (${get("weekday")}) ${period} ${get("hour")}:${get("minute")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function accountLine(booking: BookingRow): string {
  const bank = (booking.pay_bank_name ?? "").trim();
  const number = (booking.pay_account_number ?? "").trim();
  const holder = (booking.pay_account_holder ?? "").trim();
  if (!bank || !number || !holder) return "입금 계좌 미등록 — 사장님 센터에서 계좌를 먼저 등록해 주세요.";
  return `${bank} ${number} (예금주 ${holder})`;
}

interface MailContent {
  subject: string;
  headline: string;
  intro: string;
  accent: string;
  rows: { label: string; value: string }[];
  footnote: string;
}

function buildContent(kind: BookingNoticeKind, booking: BookingRow, actor?: string): MailContent {
  const slot = `${formatSlot(booking.date, booking.start_time)} ~ ${endTime(booking.start_time, booking.hours)}`;
  const deadline = formatKstDateTime(booking.expires_at);
  const baseRows: { label: string; value: string }[] = [
    { label: "공간", value: booking.space_name },
    { label: "이용 일시", value: slot },
    { label: "인원 / 시간", value: `${booking.guests}명 / ${booking.hours}시간` },
    { label: "예약자", value: `${booking.guest_name} · ${booking.guest_phone}` },
    { label: "금액", value: won(booking.total_amount) },
  ];
  if ((booking.memo ?? "").trim()) baseRows.push({ label: "요청 사항", value: (booking.memo ?? "").trim() });
  baseRows.push({
    label: "예약번호",
    value: booking.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
  });

  if (kind === "created") {
    return {
      subject: `[이곳저곳] 새 예약 접수 · ${booking.space_name} ${formatSlot(booking.date, booking.start_time)}`,
      headline: "새 예약이 접수됐어요",
      intro: "입금이 확인되면 [입금 확인(확정)]을 눌러 주세요. 15분 안에 확인하지 않으면 예약이 자동으로 풀려 다른 손님이 예약할 수 있어요.",
      accent: "#FF2E7E",
      rows: [
        ...baseRows.slice(0, 5),
        { label: "입금 계좌", value: accountLine(booking) },
        { label: "입금 기한", value: deadline ? `${deadline} 까지 (15분)` : "접수 후 15분" },
        ...baseRows.slice(5),
      ],
      footnote: "기한이 지난 예약은 자동으로 취소되며, 그 시간대는 다시 예약받을 수 있습니다.",
    };
  }

  if (kind === "confirmed") {
    return {
      subject: `[이곳저곳] 입금 확인 완료 · ${booking.space_name} ${formatSlot(booking.date, booking.start_time)}`,
      headline: "입금 확인 처리됐어요",
      intro: `${actor === "admin" ? "총괄 관리자가" : "사장님 센터에서"} 예약을 확정 상태로 바꿨습니다. 이제 15분 만료 대상에서 빠지고 손님 예약 내역에도 확정으로 표시됩니다.`,
      accent: "#0F9D58",
      rows: baseRows,
      footnote: "현장에서 손님 이름과 연락처로 예약을 확인해 주세요.",
    };
  }

  const reason =
    booking.cancel_reason === "expired"
      ? "입금 기한(15분)이 지나 자동으로 취소됐어요."
      : booking.cancel_reason === "guest"
        ? "손님이 예약을 취소했어요."
        : "예약이 취소·거절 처리됐어요.";

  return {
    subject: `[이곳저곳] 예약 취소 · ${booking.space_name} ${formatSlot(booking.date, booking.start_time)}`,
    headline: "예약이 취소됐어요",
    intro: `${reason} 취소된 시간대는 다시 예약받을 수 있습니다.`,
    accent: "#6B7280",
    rows: [
      ...baseRows.slice(0, 4),
      { label: "사유", value: reason },
      ...baseRows.slice(4),
    ],
    footnote: "이미 입금을 받으셨다면 손님께 환불 안내를 부탁드려요.",
  };
}

function renderHtml(content: MailContent, booking: BookingRow): string {
  const rows = content.rows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #F1E6EC;color:#8A7C86;font-size:13px;width:96px;vertical-align:top;">${escapeHtml(
            row.label
          )}</td>
          <td style="padding:10px 0;border-bottom:1px solid #F1E6EC;color:#1B1624;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(
            row.value
          )}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:24px 12px;background:#FDF2F8;font-family:'Apple SD Gothic Neo','Malgun Gothic',system-ui,-apple-system,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(27,22,36,0.06);">
      <tr>
        <td style="background:${content.accent};padding:22px 24px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.08em;opacity:0.9;">이곳저곳 · 예약 알림</div>
          <div style="margin-top:6px;font-size:20px;font-weight:800;">${escapeHtml(content.headline)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px 8px;">
          <p style="margin:0 0 14px;font-size:13px;line-height:1.7;color:#4A3F47;">${escapeHtml(content.intro)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          <p style="margin:14px 0 0;font-size:11px;line-height:1.6;color:#9B8E96;">${escapeHtml(content.footnote)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 24px 26px;">
          <a href="${HOST_PAGE_URL}" style="display:inline-block;background:#FF2E7E;color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;padding:12px 20px;border-radius:12px;">사장님 센터에서 확인하기</a>
          <p style="margin:12px 0 0;font-size:11px;color:#9B8E96;">${HOST_PAGE_URL}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px;background:#FFF7FA;color:#A899A1;font-size:10px;line-height:1.6;">
          이곳저곳 · 공간대여 예약 플랫폼 · 예약번호 ${booking.id.replace(/-/g, "").slice(0, 8).toUpperCase()}<br/>
          이 메일은 예약 알림을 켜 둔 공간의 사장님께 자동으로 발송됩니다.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(content: MailContent): string {
  const lines = content.rows.map((row) => `- ${row.label}: ${row.value}`);
  return [
    `이곳저곳 · ${content.headline}`,
    "",
    content.intro,
    "",
    ...lines,
    "",
    content.footnote,
    "",
    `사장님 센터: ${HOST_PAGE_URL}`,
  ].join("\n");
}

async function sendWithResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY as string;
  const from = process.env.MAIL_FROM ?? "이곳저곳 <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(process.env.MAIL_REPLY_TO ? { reply_to: process.env.MAIL_REPLY_TO } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    return { sent: false, provider: "resend", error: `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}` };
  }
  return { sent: true, provider: "resend" };
}

async function sendWithBrevo(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<MailResult> {
  const apiKey = process.env.BREVO_API_KEY as string;
  const fromRaw = process.env.MAIL_FROM ?? "이곳저곳 <no-reply@igotjeogot.com>";
  const match = fromRaw.match(/^(.*)<(.+)>$/);
  const senderName = (match?.[1] ?? "이곳저곳").trim().replace(/^"|"$/g, "");
  const senderEmail = (match?.[2] ?? fromRaw).trim();
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: args.to }],
      subject: args.subject,
      htmlContent: args.html,
      textContent: args.text,
      ...(process.env.MAIL_REPLY_TO ? { replyTo: { email: process.env.MAIL_REPLY_TO } } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    return { sent: false, provider: "brevo", error: `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}` };
  }
  return { sent: true, provider: "brevo" };
}

/**
 * 일반 메일 발송(리포트 등). Resend → Brevo 순서로 있는 수단을 쓴다.
 * 예약 알림과 같은 규칙으로 예외를 던지지 않고 결과만 돌려준다.
 */
export async function sendMail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<MailResult> {
  try {
    if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY) {
      return { sent: false, skipped: "no_provider" };
    }
    if (!args.to || !args.to.includes("@")) return { sent: false, skipped: "no_recipient" };
    const result = process.env.RESEND_API_KEY ? await sendWithResend(args) : await sendWithBrevo(args);
    if (!result.sent) console.error("[mail] 발송 실패", args.subject, result.error);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] 발송 예외", args.subject, message);
    return { sent: false, error: message };
  }
}

/** 사장님 이메일 주소를 찾는다 (service_role). */
export async function fetchHostEmail(hostId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !hostId) return null;
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from("profiles").select("email").eq("id", hostId).maybeSingle();
    if (error || !data?.email) return null;
    const email = String(data.email).trim();
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

/**
 * 예약 상태 변화를 사장님께 메일로 알린다.
 * 어떤 경우에도 예외를 던지지 않는다(예약 API 를 실패시키지 않기 위해).
 */
export async function notifyHostOfBooking(
  kind: BookingNoticeKind,
  booking: BookingRow,
  options: { actor?: "guest" | "host" | "admin" | "system"; to?: string | null } = {}
): Promise<MailResult> {
  try {
    if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY) {
      console.warn("[mail] 메일 발송 수단이 설정되지 않았습니다 (RESEND_API_KEY / BREVO_API_KEY).");
      return { sent: false, skipped: "no_provider" };
    }
    const to = options.to ?? (await fetchHostEmail(booking.host_id));
    if (!to) return { sent: false, skipped: "no_host_email" };

    const content = buildContent(kind, booking, options.actor);
    const args = {
      to,
      subject: content.subject,
      html: renderHtml(content, booking),
      text: renderText(content),
    };

    const result = process.env.RESEND_API_KEY ? await sendWithResend(args) : await sendWithBrevo(args);
    if (!result.sent) console.error("[mail] 사장님 알림 발송 실패", kind, result.error);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] 사장님 알림 발송 예외", kind, message);
    return { sent: false, error: message };
  }
}

export { formatKstDateTime, formatSlot };
