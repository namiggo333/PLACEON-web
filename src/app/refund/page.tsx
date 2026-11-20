import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "취소·환불 규정 · 이곳저곳",
  description: "이곳저곳 공간 예약의 취소 시점별 환불 비율과 처리 절차를 안내합니다.",
};

const ROWS: { when: string; rate: string; note: string }[] = [
  { when: "이용일 3일 전까지", rate: "100%", note: "결제 금액 전액 환불" },
  { when: "이용일 2일 전", rate: "70%", note: "결제 금액의 70% 환불" },
  { when: "이용일 1일 전", rate: "50%", note: "결제 금액의 50% 환불" },
  { when: "이용 당일 · 이용 시작 이후 · 노쇼", rate: "환불 불가", note: "사장님과 별도 협의" },
];

export default function RefundPage() {
  return (
    <LegalDoc
      title="취소·환불 규정"
      lead="이용일 기준으로 아래 환불 비율이 적용됩니다. 취소는 이용일과 이용 시작 시각을 기준으로 계산하며, 결제 수단과 관계없이 동일하게 적용됩니다."
      effectiveDate="2026년 11월 18일"
      notice={
        <div className="overflow-x-auto">
          <p className="mb-2 font-bold text-ink">이용일 기준 표준 환불 비율</p>
          <table className="w-full min-w-[480px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-white/70 text-ink">
                <th className="border border-brand/15 px-3 py-2 text-left font-bold">취소 시점</th>
                <th className="border border-brand/15 px-3 py-2 text-left font-bold">환불 비율</th>
                <th className="border border-brand/15 px-3 py-2 text-left font-bold">비고</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.when}>
                  <td className="border border-brand/15 px-3 py-2 font-semibold text-ink">{row.when}</td>
                  <td className="border border-brand/15 px-3 py-2 font-extrabold text-brand-dark">{row.rate}</td>
                  <td className="border border-brand/15 px-3 py-2">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-ink-mute">
            예시: 11월 20일 18시 이용 예약을 11월 17일 18시 이전에 취소하면 100%, 11월 18일에는 70%, 11월 19일에는
            50%가 환불됩니다.
          </p>
        </div>
      }
      sections={[
        {
          id: "principle",
          title: "기본 원칙",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>취소 시점은 손님이 취소를 요청한 시각과 이용 시작 시각의 차이로 계산합니다.</li>
              <li>예약 신청 후 사장님이 확정하기 전(대기중)에는 언제든지 무료로 취소할 수 있습니다.</li>
              <li>전용 결제 링크(비회원)로 결제한 예약도 같은 기준이 적용됩니다.</li>
              <li>환불은 결제한 수단으로 돌려드리며, 카드 취소는 카드사 정책에 따라 영업일 기준 3~5일이 걸릴 수 있습니다.</li>
            </ul>
          ),
        },
        {
          id: "full-refund",
          title: "전액 환불되는 경우",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>이용일 3일 전까지 취소한 경우</li>
              <li>공간 정보와 실제 시설이 크게 달라 이용이 어려운 경우(사장님 귀책)</li>
              <li>시스템 오류로 같은 시간대에 예약이 중복되어 이용할 수 없게 된 경우</li>
              <li>사장님이 예약을 일방적으로 취소하거나 확정 후 이용을 거절한 경우</li>
              <li>천재지변·재난 등 불가항력으로 공간을 이용할 수 없게 된 경우(협의 후 처리)</li>
            </ul>
          ),
        },
        {
          id: "no-refund",
          title: "환불이 제한되는 경우",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>이용 당일 취소 또는 연락 없이 방문하지 않은 경우(노쇼)</li>
              <li>이미 이용을 시작한 뒤 남은 시간을 사용하지 않은 경우</li>
              <li>손님의 사정으로 이용 인원·목적이 크게 바뀌어 사장님이 수용하기 어려운 경우</li>
            </ul>
          ),
        },
        {
          id: "partial",
          title: "부분 취소·변경",
          body: (
            <p>
              이용 시간을 줄이거나 날짜·시간을 변경하려면 사장님과 협의해 주세요. 이용일 3일 전까지는 1회에 한해 무료로
              변경을 요청할 수 있으며, 변경 가능 여부는 해당 시간대의 공실 상황에 따라 달라집니다. 이미 결제한 금액이
              줄어드는 경우 차액을 같은 방법으로 환불합니다.
            </p>
          ),
        },
        {
          id: "process",
          title: "취소·환불 절차",
          body: (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>로그인 후 ‘예약 내역’에서 취소를 요청하거나, 비회원은 사장님께 연락해 취소를 요청합니다.</li>
              <li>취소 접수 시 예약 상태가 ‘취소’로 바뀌고 해당 시간대가 다시 예약 가능 상태로 열립니다.</li>
              <li>환불 금액을 위 기준으로 계산해 결제 수단으로 환불합니다.</li>
              <li>환불 완료 여부는 예약 내역 또는 사장님 안내로 확인하실 수 있습니다.</li>
            </ol>
          ),
        },
        {
          id: "dispute",
          title: "분쟁 발생 시",
          body: (
            <p>
              환불 금액이나 귀책 사유에 이견이 있는 경우 namiggo333@gmail.com 으로 예약번호와 함께 알려주세요. 이곳저곳은
              예약 기록과 결제 내역을 확인해 사실관계를 정리하고, 사장님과 손님 사이의 원만한 해결을 돕습니다. 필요하면
              한국소비자원(1372) 상담을 안내드립니다.
            </p>
          ),
        },
        {
          id: "etc",
          title: "기타",
          body: (
            <p>
              본 규정에 정하지 않은 사항은 관련 법령(전자상거래법, 소비자기본법 등)과 이곳저곳 이용약관에 따릅니다. 규정이
              변경되는 경우 시행 7일 전부터 서비스 화면에 공지합니다.
            </p>
          ),
        },
      ]}
    />
  );
}
