import { supabase } from "./supabase";

/** 서버가 돌려주는 점유 시간대 — 개인정보 없이 시간과 종류만 담긴다. */
export interface OccupiedSlot {
  startAt: string;
  endAt: string;
  source: "guest" | "block";
}

/** KST 기준 오프셋 (한국은 서머타임이 없어 항상 +09:00) */
const KST_OFFSET = "+09:00";

function toMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00${KST_OFFSET}`).getTime();
}

function slotStartMs(slot: OccupiedSlot): number {
  return new Date(slot.startAt).getTime();
}

function slotEndMs(slot: OccupiedSlot): number {
  return new Date(slot.endAt).getTime();
}

/**
 * 공간·날짜 범위의 점유 시간대를 조회한다.
 * DB RPC(`get_occupied_slots`)는 이름·연락처를 포함하지 않으므로 비로그인 손님도 호출할 수 있다.
 */
export async function fetchOccupiedSlots(spaceId: string, from: string, to: string): Promise<OccupiedSlot[]> {
  if (!supabase || !spaceId) return [];
  try {
    const { data, error } = await supabase.rpc("get_occupied_slots", {
      p_space: spaceId,
      p_from: from,
      p_to: to,
    });
    if (error) {
      console.warn("[availability] 점유 시간을 불러오지 못했어요.", error.message);
      return [];
    }
    const rows = (data ?? []) as { start_at: string; end_at: string; source: string }[];
    return rows
      .filter((row) => Boolean(row.start_at) && Boolean(row.end_at))
      .map((row) => ({
        startAt: row.start_at,
        endAt: row.end_at,
        source: row.source === "block" ? "block" : "guest",
      }));
  } catch (error) {
    console.warn("[availability] 점유 시간 조회 실패", error);
    return [];
  }
}

/** 선택한 시간대가 이미 점유되어 있는지 */
export function isSlotTaken(date: string, startTime: string, hours: number, occupied: OccupiedSlot[]): boolean {
  if (!date || !startTime || !hours) return false;
  const start = toMs(date, startTime);
  const end = start + hours * 60 * 60 * 1000;
  return occupied.some((slot) => start < slotEndMs(slot) && slotStartMs(slot) < end);
}

/** 이미 지난 시간인지 */
export function isSlotPast(date: string, startTime: string): boolean {
  if (!date || !startTime) return false;
  return toMs(date, startTime) <= Date.now();
}

export interface SlotStatus {
  start: string;
  taken: boolean;
  past: boolean;
  /** 이 시간대를 막고 있는 점유의 종류 (손님 예약/사장님 차단) */
  blockedBy: "guest" | "block" | null;
}

/**
 * 시작 시간 후보 목록에 대해, 현재 선택된 이용 시간(hours)까지 고려해
 * 예약 가능 여부를 계산한다.
 */
export function buildSlotStatuses(
  date: string,
  slots: string[],
  hours: number,
  occupied: OccupiedSlot[]
): SlotStatus[] {
  return slots.map((start) => {
    const startMs = toMs(date, start);
    const endMs = startMs + hours * 60 * 60 * 1000;
    const hit = occupied.find((slot) => startMs < slotEndMs(slot) && slotStartMs(slot) < endMs);
    return {
      start,
      taken: Boolean(hit),
      past: startMs <= Date.now(),
      blockedBy: hit ? hit.source : null,
    };
  });
}
