/**
 * 공간 정보가 바뀌었을 때 홈(ISR) 캐시를 즉시 갱신한다.
 * 실패해도 사용자 흐름을 막지 않는다(최대 60초 뒤 자동 갱신).
 */
export function revalidateHomeCache(): void {
  if (typeof window === "undefined") return;
  void fetch("/api/revalidate", { method: "POST" }).catch(() => {
    /* 무시: 다음 ISR 주기에 자동 반영 */
  });
}
