"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CalendarIcon, CheckIcon, SparkleIcon } from "@/components/Icons";
import { cn, formatDate, formatTime } from "@/lib/format";
import { overlapsBusy, parsePastedBookings, isPastSlot, type ParsedBlockRow } from "@/lib/paste-parser";
import type { Booking, Space } from "@/lib/types";
import { won } from "@/lib/format";

const SAMPLE = `11/25 14:00~17:00 홍길동
2026-11-26 오후 2시~5시
12월 1일 18:00-21:00 기업 촬영
내일 10시~12시 워크샵`;

function busySlotsOf(bookings: Booking[], spaceId: string) {
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
 * 외부 예약 일괄 붙여넣기 (6~10단계 8번).
 * 카톡·문자·엑셀에서 복사한 여러 줄을 파싱해 미리보기 → 한 번에 시간 차단 등록.
 */
export function PasteImporter({
  mySpaces,
  spaceId,
  onSpaceChange,
  onToast,
}: {
  mySpaces: Space[];
  spaceId: string;
  onSpaceChange: (id: string) => void;
  onToast: (message: string) => void;
}) {
  const { bookings, createBlocks } = useApp();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedBlockRow[] | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<{ row: ParsedBlockRow; reason: string }[]>([]);

  const space = mySpaces.find((item) => item.id === spaceId) ?? mySpaces[0];
  const busySlots = useMemo(() => (space ? busySlotsOf(bookings, space.id) : []), [bookings, space]);

  const evaluated = useMemo(() => {
    if (!rows) return [];
    return rows.map((row) => {
      const conflict = overlapsBusy(row, busySlots);
      const past = isPastSlot(row);
      const reason = row.error
        ? row.error
        : past
          ? "이미 지난 시간이에요."
          : conflict === "guest"
            ? "이미 예약이 있는 시간이에요."
            : conflict === "block"
              ? "이미 차단된 시간이에요."
              : "";
      return { row, reason, ok: !reason };
    });
  }, [rows, busySlots]);

  const readyCount = evaluated.filter((item) => item.ok).length;

  function preview() {
    setError("");
    setFailures([]);
    const parsed = parsePastedBookings(text);
    if (parsed.length === 0) {
      setRows(null);
      setError("붙여넣은 내용이 없어요. 예약 시간을 한 줄에 하나씩 넣어 주세요.");
      return;
    }
    setRows(parsed);
  }

  async function register() {
    if (!space) return;
    const targets = evaluated.filter((item) => item.ok);
    if (targets.length === 0) return;
    setBusy(true);
    setError("");
    setFailures([]);
    try {
      const results = await createBlocks(
        space.id,
        targets.map((item) => ({
          date: item.row.date as string,
          startTime: item.row.startTime as string,
          hours: item.row.hours as number,
          memo: item.row.memo || "외부 예약",
        }))
      );
      const failed = results
        .filter((result) => !result.ok)
        .map((result) => ({ row: targets[result.index]?.row, reason: result.error ?? "등록하지 못했어요." }))
        .filter((item): item is { row: ParsedBlockRow; reason: string } => Boolean(item.row));
      const done = results.filter((result) => result.ok).length;
      setFailures(failed);
      if (done > 0) {
        onToast(`${done}건을 시간 차단으로 등록했어요.`);
        setRows(null);
        setText("");
      }
      if (failed.length > 0) setError(`${failed.length}건은 등록하지 못했어요. 사유를 확인해 주세요.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 등록에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-light text-brand">
            <CalendarIcon size={18} />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-ink">외부 예약 일괄 붙여넣기</h2>
            <p className="text-[10px] text-ink-mute">
              카톡·문자·엑셀 예약을 그대로 붙여넣으면 날짜·시간을 읽어 한 번에 차단해요.
            </p>
          </div>
        </div>
        <select
          value={space?.id ?? ""}
          onChange={(event) => onSpaceChange(event.target.value)}
          className="input h-9 max-w-[180px] text-xs"
          aria-label="붙여넣기 등록할 공간"
          disabled={mySpaces.length === 0}
        >
          {mySpaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        placeholder={`예)\n11/25 14:00~17:00\n2026-11-26 오후 2시~5시\n12월 1일 18:00-21:00 홍길동`}
        className="input mt-3 w-full resize-y text-xs leading-relaxed"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={preview} className="btn-primary btn-sm" disabled={!text.trim()}>
          <SparkleIcon size={13} />
          미리보기
        </button>
        <button type="button" onClick={() => setShowSamples((value) => !value)} className="btn-ghost btn-sm">
          예시 보기
        </button>
        <button
          type="button"
          onClick={() => {
            setText(SAMPLE);
            setRows(null);
            setError("");
          }}
          className="btn-ghost btn-sm"
        >
          예시 채우기
        </button>
      </div>

      {showSamples && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-line/30 p-3 text-[10.5px] leading-relaxed text-ink-soft">
{`11/25 14:00~17:00
2026-11-26 오후 2시~5시
12월 1일 18:00-21:00 홍길동
11.27 14시부터 17시까지 김철수
내일 2시~5시 생일파티
다음주 화요일 오후 7시~9시`}
        </pre>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10.5px] font-medium text-red-600">{error}</p>
      )}

      {rows && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-ink-line">
          <table className="w-full min-w-[520px] text-left text-[11px]">
            <thead className="bg-ink-line/30 text-[10px] font-bold text-ink-mute">
              <tr>
                <th className="px-2.5 py-2">상태</th>
                <th className="px-2.5 py-2">날짜</th>
                <th className="px-2.5 py-2">시간</th>
                <th className="px-2.5 py-2">이용</th>
                <th className="px-2.5 py-2">메모</th>
                <th className="px-2.5 py-2">사유</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {evaluated.map((item, index) => (
                <tr key={`${item.row.raw}-${index}`} className={item.ok ? "" : "bg-red-50/40"}>
                  <td className="px-2.5 py-2">
                    <span
                      className={cn(
                        "badge",
                        item.ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                      )}
                    >
                      {item.ok ? "등록 가능" : "제외"}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 font-semibold text-ink">
                    {item.row.date ? formatDate(item.row.date) : "—"}
                  </td>
                  <td className="px-2.5 py-2 text-ink-soft">
                    {item.row.startTime ? formatTime(item.row.startTime) : "—"}
                  </td>
                  <td className="px-2.5 py-2 text-ink-soft">{item.row.hours ? `${item.row.hours}시간` : "—"}</td>
                  <td className="max-w-[120px] truncate px-2.5 py-2 text-ink-mute">{item.row.memo || "—"}</td>
                  <td className="px-2.5 py-2 text-[10px] text-ink-mute">{item.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {failures.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg bg-amber-50 px-2.5 py-2 text-[10.5px] text-amber-800">
          {failures.map((item, index) => (
            <p key={`fail-${index}`}>
              · {item.row.raw} — {item.reason}
            </p>
          ))}
        </div>
      )}

      {rows && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-ink-mute">
            등록 가능 <b className="text-brand">{readyCount}</b>건 / 전체 {rows.length}건 ·{" "}
            {space ? `${space.name} · 시간당 ${won(space.pricePerHour)}` : "공간을 선택해 주세요"}
          </p>
          <button
            type="button"
            onClick={() => void register()}
            disabled={busy || readyCount === 0 || !space}
            className="btn-primary btn-sm"
          >
            <CheckIcon size={13} />
            {busy ? "등록 중…" : `${readyCount}건 일괄 차단`}
          </button>
        </div>
      )}
    </section>
  );
}
