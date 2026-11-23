"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CheckIcon, ClockIcon, CopyIcon, LinkIcon } from "@/components/Icons";
import { cn, formatDate, formatTime } from "@/lib/format";
import { parseIcs } from "@/lib/ical";
import { overlapsBusy, isPastSlot, type BusySlot } from "@/lib/paste-parser";
import type { Booking, Space } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface FeedRow {
  id: string;
  name: string;
  token: string;
  url: string;
}

interface ImportRow {
  date: string;
  startTime: string;
  hours: number;
  memo: string;
  reason: string;
  ok: boolean;
}

function busySlotsOf(bookings: Booking[], spaceId: string): BusySlot[] {
  return bookings
    .filter((booking) => booking.spaceId === spaceId && booking.status !== "cancelled")
    .map((booking) => ({
      date: booking.date,
      startTime: booking.startTime,
      hours: booking.hours,
      source: booking.source,
    }));
}

/**
 * iCal 캘린더 연동 (6~10단계 10번).
 * - 내보내기: 공간별 구독 주소(.ics)를 복사해 구글·애플 캘린더에 등록.
 * - 가져오기: 외부 .ics 주소나 파일 내용을 읽어 시간 차단으로 일괄 반영.
 */
export function IcalPanel({
  mySpaces,
  onToast,
}: {
  mySpaces: Space[];
  onToast: (message: string) => void;
}) {
  const { mode, bookings, createBlocks } = useApp();
  const [spaceId, setSpaceId] = useState(mySpaces[0]?.id ?? "");
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedError, setFeedError] = useState("");

  const [importMode, setImportMode] = useState<"url" | "text">("url");
  const [importUrl, setImportUrl] = useState("");
  const [icsText, setIcsText] = useState("");
  const [importSpaceId, setImportSpaceId] = useState(mySpaces[0]?.id ?? "");
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [failures, setFailures] = useState<string[]>([]);

  const selectedSpace = mySpaces.find((space) => space.id === spaceId) ?? mySpaces[0];
  const feed = feeds.find((row) => row.id === (selectedSpace?.id ?? ""));

  useEffect(() => {
    if (!spaceId && mySpaces[0]?.id) setSpaceId(mySpaces[0].id);
    if (!importSpaceId && mySpaces[0]?.id) setImportSpaceId(mySpaces[0].id);
  }, [mySpaces, spaceId, importSpaceId]);

  useEffect(() => {
    if (mode !== "supabase" || mySpaces.length === 0) return;
    let alive = true;
    (async () => {
      setFeedBusy(true);
      setFeedError("");
      try {
        const { data } = await (supabase as NonNullable<typeof supabase>).auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setFeedError("로그인이 끝났어요. 다시 로그인해 주세요.");
          return;
        }
        const response = await fetch("/api/host/ical", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json().catch(() => null)) as { spaces?: FeedRow[]; error?: string } | null;
        if (!response.ok || !payload?.spaces) {
          setFeedError(payload?.error ?? "구독 주소를 불러오지 못했어요.");
          return;
        }
        if (alive) setFeeds(payload.spaces);
      } catch {
        if (alive) setFeedError("구독 주소를 불러오지 못했어요.");
      } finally {
        if (alive) setFeedBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, mySpaces.length]);

  async function copy(text: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      onToast("구독 주소를 복사했어요!");
    } catch {
      onToast("복사가 차단됐어요. 주소를 길게 눌러 복사해 주세요.");
    }
  }

  const importBusySlots = useMemo(
    () => busySlotsOf(bookings, importSpaceId),
    [bookings, importSpaceId]
  );

  function evaluate(events: ReturnType<typeof parseIcs>["events"]): ImportRow[] {
    return events.map((event) => {
      const base: ImportRow = { date: "", startTime: "", hours: 1, memo: event.summary, reason: "", ok: false };
      if (event.allDay || !event.start.includes("T")) {
        return { ...base, reason: "하루 종일 일정은 시간을 정할 수 없어 직접 등록해 주세요." };
      }
      const [date, time] = event.start.split("T");
      const [endDate] = event.end.split("T");
      if (endDate !== date) {
        return { ...base, date, reason: "여러 날에 걸친 일정이에요. 날짜별로 나눠 등록해 주세요." };
      }
      const [eh] = event.end.split("T")[1].split(":").map(Number);
      const [sh] = time.split(":").map(Number);
      const hours = Math.max(1, Math.round(eh - sh));
      const row: ImportRow = { date, startTime: time.slice(0, 5), hours, memo: event.summary, reason: "", ok: true };
      const conflict = overlapsBusy(row, importBusySlots);
      if (isPastSlot(row)) row.reason = "이미 지난 시간이에요.";
      else if (conflict === "guest") row.reason = "이미 예약이 있는 시간이에요.";
      else if (conflict === "block") row.reason = "이미 차단된 시간이에요.";
      row.ok = !row.reason;
      return row;
    });
  }

  async function loadIcs() {
    setImportError("");
    setFailures([]);
    let text = icsText;
    if (importMode === "url") {
      if (!/^https?:\/\//i.test(importUrl.trim())) {
        setImportError("캘린더 주소(http로 시작)를 넣어 주세요.");
        return;
      }
      try {
        const { data } = await (supabase as NonNullable<typeof supabase>).auth.getSession();
        const token = data.session?.access_token;
        const response = await fetch("/api/host/ical", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action: "fetch", url: importUrl.trim() }),
        });
        const payload = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
        if (!response.ok || !payload?.text) {
          setImportError(payload?.error ?? "캘린더를 가져오지 못했어요.");
          return;
        }
        text = payload.text;
        setIcsText(text);
      } catch {
        setImportError("캘린더를 가져오지 못했어요. 주소가 공개되어 있는지 확인해 주세요.");
        return;
      }
    }

    if (!text.trim()) {
      setImportError("가져올 .ics 내용이 없어요.");
      return;
    }
    const parsed = parseIcs(text);
    if (parsed.error) {
      setImportError(parsed.error);
      setImportRows(null);
      return;
    }
    setImportRows(evaluate(parsed.events));
  }

  async function registerImport() {
    if (!importRows) return;
    const targets = importRows.filter((row) => row.ok);
    if (targets.length === 0 || !importSpaceId) return;
    setImportBusy(true);
    setImportError("");
    setFailures([]);
    try {
      const results = await createBlocks(
        importSpaceId,
        targets.map((row) => ({
          date: row.date,
          startTime: row.startTime,
          hours: row.hours,
          memo: row.memo ? `캘린더: ${row.memo}` : "캘린더 가져오기",
        }))
      );
      const failed = results.filter((result) => !result.ok);
      const done = results.length - failed.length;
      if (done > 0) {
        onToast(`${done}건을 캘린더에서 가져와 차단했어요.`);
        setImportRows(null);
      }
      if (failed.length > 0) {
        setFailures(
          failed.map((result) => {
            const row = targets[result.index];
            return `${row?.date ?? ""} ${row?.startTime ?? ""} — ${result.error ?? "등록하지 못했어요."}`;
          })
        );
        setImportError(`${failed.length}건은 등록하지 못했어요.`);
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "가져오기에 실패했어요.");
    } finally {
      setImportBusy(false);
    }
  }

  const readyCount = importRows?.filter((row) => row.ok).length ?? 0;
  // 공휴일 캘린더처럼 수백 건이 들어와도 화면이 버티도록 미리보기는 50건까지만 그린다.
  const visibleRows = importRows?.slice(0, 50) ?? [];
  const hiddenCount = (importRows?.length ?? 0) - visibleRows.length;

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-light text-brand-dark">
          <LinkIcon size={18} />
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-ink">캘린더 연동 (.ics)</h2>
          <p className="text-[12px] text-ink-mute">
            내 캘린더에서 예약·차단 일정을 구독하고, 다른 캘린더 일정은 시간 차단으로 가져와요.
          </p>
        </div>
      </div>

      {/* 내보내기 */}
      <div className="mt-3 rounded-xl bg-ink-line/25 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-bold text-ink">
            <ClockIcon size={12} className="mr-1 inline text-brand-dark" />
            내 공간 일정 구독 주소
          </p>
          <select
            value={selectedSpace?.id ?? ""}
            onChange={(event) => setSpaceId(event.target.value)}
            className="input h-8 max-w-[170px] text-[12px]"
            aria-label="구독할 공간"
            disabled={mySpaces.length === 0}
          >
            {mySpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 flex gap-2">
          <input
            readOnly
            value={feed?.url ?? (feedBusy ? "구독 주소를 만드는 중…" : "")}
            placeholder={mode === "supabase" ? "구독 주소를 불러오는 중이에요" : "Supabase 연결 후 사용할 수 있어요"}
            className="input h-9 min-w-0 flex-1 bg-white text-[12px]"
          />
          <button
            type="button"
            className="btn-primary shrink-0 px-3 text-[12px]"
            disabled={!feed?.url}
            onClick={() => void copy(feed?.url ?? "")}
          >
            <CopyIcon size={14} />
            복사
          </button>
        </div>
        {feedError && <p className="mt-1.5 text-[12px] font-medium text-red-500">{feedError}</p>}
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">
          구글 캘린더 → 다른 캘린더 + → URL로 추가에 붙여넣으면 예약·차단 시간이 자동으로 동기화돼요. 손님 이름·연락처는
          담기지 않고 시간만 표시됩니다.
        </p>
      </div>

      {/* 가져오기 */}
      <div className="mt-3 rounded-xl border border-ink-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-bold text-ink">다른 캘린더 일정 가져오기</p>
          <div className="flex gap-1 rounded-lg bg-ink-line/30 p-0.5">
            {(["url", "text"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setImportMode(item)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[12px] font-bold transition",
                  importMode === item ? "bg-white text-brand-dark shadow-sm" : "text-ink-mute"
                )}
              >
                {item === "url" ? "주소로" : "내용 붙여넣기"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <select
            value={importSpaceId}
            onChange={(event) => setImportSpaceId(event.target.value)}
            className="input h-9 text-[12px]"
            aria-label="가져온 일정을 차단할 공간"
            disabled={mySpaces.length === 0}
          >
            {mySpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
          {importMode === "url" ? (
            <div className="flex gap-2">
              <input
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                placeholder="https://calendar.google.com/.../basic.ics"
                className="input h-9 min-w-0 flex-1 text-[12px]"
              />
              <button type="button" onClick={() => void loadIcs()} className="btn-soft btn-sm shrink-0">
                가져오기
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void loadIcs()} className="btn-soft btn-sm shrink-0">
              내용 읽기
            </button>
          )}
        </div>

        {importMode === "text" && (
          <textarea
            value={icsText}
            onChange={(event) => setIcsText(event.target.value)}
            rows={4}
            placeholder={"BEGIN:VCALENDAR … END:VCALENDAR 내용을 붙여넣으세요"}
            className="input mt-2 w-full resize-y font-mono text-[12px] leading-relaxed"
          />
        )}

        {importError && (
          <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-600">{importError}</p>
        )}
        {failures.length > 0 && (
          <div className="mt-2 space-y-1 rounded-lg bg-amber-50 px-2.5 py-2 text-[12px] text-amber-800">
            {failures.map((line) => (
              <p key={line}>· {line}</p>
            ))}
          </div>
        )}

        {importRows && (
          <div className="mt-2 overflow-x-auto rounded-xl border border-ink-line">
            <table className="w-full min-w-[480px] text-left text-[12px]">
              <thead className="bg-ink-line/30 text-[12px] font-bold text-ink-mute">
                <tr>
                  <th className="px-2.5 py-2">상태</th>
                  <th className="px-2.5 py-2">날짜</th>
                  <th className="px-2.5 py-2">시간</th>
                  <th className="px-2.5 py-2">이용</th>
                  <th className="px-2.5 py-2">일정</th>
                  <th className="px-2.5 py-2">사유</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {visibleRows.map((row, index) => (
                  <tr key={`${row.date}-${row.startTime}-${index}`} className={row.ok ? "" : "bg-red-50/40"}>
                    <td className="px-2.5 py-2">
                      <span className={cn("badge", row.ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}>
                        {row.ok ? "등록 가능" : "제외"}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-semibold text-ink">{row.date ? formatDate(row.date) : "—"}</td>
                    <td className="px-2.5 py-2 text-ink-soft">
                      {row.startTime ? formatTime(row.startTime) : "—"}
                    </td>
                    <td className="px-2.5 py-2 text-ink-soft">{row.hours}시간</td>
                    <td className="max-w-[130px] truncate px-2.5 py-2 text-ink-mute">{row.memo || "—"}</td>
                    <td className="px-2.5 py-2 text-[12px] text-ink-mute">{row.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {importRows && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-ink-mute">
              등록 가능 <b className="text-brand-dark">{readyCount}</b>건 / 전체 {importRows.length}건
              {hiddenCount > 0 ? ` · 표시는 50건까지` : ""}
            </p>
            <button
              type="button"
              onClick={() => void registerImport()}
              disabled={importBusy || readyCount === 0}
              className="btn-primary btn-sm"
            >
              <CheckIcon size={13} />
              {importBusy ? "반영 중…" : `${readyCount}건 차단으로 반영`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
