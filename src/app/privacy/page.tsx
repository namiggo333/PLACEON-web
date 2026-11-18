import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "개인정보처리방침 · 이곳저곳",
  description: "이곳저곳이 수집하는 개인정보 항목, 이용 목적, 보관 기간, 문의처를 안내합니다.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="개인정보처리방침"
      lead="이곳저곳은 예약과 결제에 꼭 필요한 정보만 수집하고, 안내한 기간 동안만 보관한 뒤 파기합니다. 아래에서 어떤 정보를 어떤 목적으로 다루는지 확인하실 수 있습니다."
      effectiveDate="2026년 11월 18일"
      notice={
        <p>
          이 방침은 개인정보보호법 제30조에 따라 작성되었습니다. 수집 항목이나 위탁 업체가 바뀌면 시행 전에 이 화면에서
          안내드립니다.
        </p>
      }
      sections={[
        {
          id: "purpose",
          title: "개인정보의 처리 목적",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>예약 신청·확인·확정 안내 등 공간 예약 서비스 제공</li>
              <li>예약자 확인, 중복 예약·부정 예약 방지, 분쟁 대응</li>
              <li>결제 안내와 취소·환불 처리</li>
              <li>회원 가입·로그인, 사장님 센터의 공간·예약 관리</li>
              <li>서비스 품질 개선을 위한 이용 통계 분석(개인을 식별하지 않는 형태)</li>
              <li>법령상 의무 이행 및 고객 문의 응대</li>
            </ul>
          ),
        },
        {
          id: "items",
          title: "처리하는 개인정보 항목",
          body: (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-brand-light/60 text-ink">
                      <th className="border border-ink-line px-3 py-2 text-left font-bold">구분</th>
                      <th className="border border-ink-line px-3 py-2 text-left font-bold">수집 항목</th>
                      <th className="border border-ink-line px-3 py-2 text-left font-bold">수집 시점</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-ink-line px-3 py-2">예약(비회원 포함)</td>
                      <td className="border border-ink-line px-3 py-2">
                        예약자 이름, 휴대폰 번호, 이용 날짜·시간·인원, 요청 사항, 예약한 공간 정보
                      </td>
                      <td className="border border-ink-line px-3 py-2">예약 신청 시</td>
                    </tr>
                    <tr>
                      <td className="border border-ink-line px-3 py-2">회원</td>
                      <td className="border border-ink-line px-3 py-2">
                        이메일, 비밀번호(단방향 암호화 저장), 이름, 휴대폰 번호(선택), 회원 유형(손님/사장님)
                      </td>
                      <td className="border border-ink-line px-3 py-2">회원가입 시</td>
                    </tr>
                    <tr>
                      <td className="border border-ink-line px-3 py-2">사장님</td>
                      <td className="border border-ink-line px-3 py-2">
                        공간 정보(주소·요금·시설·사진), 정산을 위한 연락처
                      </td>
                      <td className="border border-ink-line px-3 py-2">공간 등록 시</td>
                    </tr>
                    <tr>
                      <td className="border border-ink-line px-3 py-2">자동 수집</td>
                      <td className="border border-ink-line px-3 py-2">
                        접속 IP, 브라우저·기기 정보, 접속 일시, 서비스 이용 기록(예약·조회 이력)
                      </td>
                      <td className="border border-ink-line px-3 py-2">서비스 이용 과정에서 자동 생성</td>
                    </tr>
                    <tr>
                      <td className="border border-ink-line px-3 py-2">결제</td>
                      <td className="border border-ink-line px-3 py-2">
                        결제대행사(PG)가 카드 정보를 직접 처리하며, 이곳저곳은 카드번호·CVC를 저장하지 않습니다.
                        결제 승인 결과(승인번호·금액·일시)만 보관합니다.
                      </td>
                      <td className="border border-ink-line px-3 py-2">결제 진행 시</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] text-ink-mute">
                주민등록번호, 여권번호, 계좌번호 등 민감하거나 고유식별에 해당하는 정보는 수집하지 않습니다.
              </p>
            </>
          ),
        },
        {
          id: "retention",
          title: "개인정보의 처리 및 보유 기간",
          body: (
            <>
              <p>수집한 개인정보는 목적을 달성하면 지체 없이 파기합니다. 다만 아래 기간은 관련 법령에 따라 보관합니다.</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>회원 정보: 회원 탈퇴 시까지(탈퇴 후 즉시 파기)</li>
                <li>예약·결제 기록: 5년 (전자상거래법 — 계약 또는 청약철회, 대금결제 및 재화 공급 기록)</li>
                <li>소비자 불만 또는 분쟁 처리 기록: 3년 (전자상거래법)</li>
                <li>표시·광고에 관한 기록: 6개월 (전자상거래법)</li>
                <li>웹사이트 접속 기록: 3개월 (통신비밀보호법)</li>
              </ul>
            </>
          ),
        },
        {
          id: "third-party",
          title: "개인정보의 제3자 제공",
          body: (
            <>
              <p>이곳저곳은 원칙적으로 개인정보를 외부에 제공하지 않습니다. 다만 예약 이행을 위해 아래 범위에서 제공합니다.</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <b className="text-ink">제공받는 자</b>: 예약한 공간의 사장님
                </li>
                <li>
                  <b className="text-ink">제공 항목</b>: 예약자 이름, 휴대폰 번호, 이용 날짜·시간·인원, 요청 사항
                </li>
                <li>
                  <b className="text-ink">제공 목적</b>: 예약 확인·확정 안내, 공간 이용 안내, 출입 관리
                </li>
                <li>
                  <b className="text-ink">보유 기간</b>: 예약 이행 완료 및 분쟁 대응 기간까지
                </li>
              </ul>
              <p>법령에 따라 수사기관이 요청하는 경우 등 법정 사유가 있을 때는 예외로 합니다.</p>
            </>
          ),
        },
        {
          id: "entrust",
          title: "개인정보 처리의 위탁",
          body: (
            <>
              <p>서비스 운영을 위해 아래 업체에 처리를 위탁하고 있으며, 위탁 계약 시 개인정보 보호 의무를 명시합니다.</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Supabase Inc. — 데이터베이스 및 파일 저장(서버 리전: 일본 도쿄)</li>
                <li>Vercel Inc. — 웹사이트 호스팅 및 배포</li>
                <li>결제대행사(PG) — 카드 결제 승인·취소 처리</li>
              </ul>
              <p className="text-[12px] text-ink-mute">
                일부 데이터가 국외 서버에 저장될 수 있으며, 이 경우 암호화된 통신(HTTPS)으로 전송됩니다.
              </p>
            </>
          ),
        },
        {
          id: "destroy",
          title: "개인정보의 파기 절차와 방법",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>파기 사유가 발생하면 보관 기간이 끝난 정보를 지체 없이 파기합니다.</li>
              <li>전자적 파일은 복구할 수 없는 방법으로 삭제하고, 종이 문서는 분쇄하거나 소각합니다.</li>
              <li>법령에 따라 보관해야 하는 기록은 별도 저장 공간에 분리 보관한 뒤 기간 만료 시 파기합니다.</li>
            </ul>
          ),
        },
        {
          id: "rights",
          title: "정보주체의 권리와 행사 방법",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>본인 또는 법정대리인은 언제든지 자신의 개인정보를 조회·정정·삭제하거나 처리 정지를 요구할 수 있습니다.</li>
              <li>예약 내역은 로그인 후 ‘예약 내역’ 화면에서 확인할 수 있으며, 계정 정보 변경은 문의처로 요청하실 수 있습니다.</li>
              <li>요청은 이메일로 접수하며, 본인 확인 후 10일 이내에 처리 결과를 안내합니다.</li>
              <li>권리 행사로 인해 예약 이행이 어려운 경우 해당 내용을 함께 안내드립니다.</li>
            </ul>
          ),
        },
        {
          id: "security",
          title: "개인정보의 안전성 확보 조치",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>비밀번호는 복호화할 수 없는 방식으로 암호화하여 저장합니다.</li>
              <li>모든 통신 구간은 HTTPS로 암호화합니다.</li>
              <li>데이터베이스 접근 권한을 역할별로 분리하고, 예약 생성은 서버에서만 처리되도록 제한합니다.</li>
              <li>개인정보 취급 인원을 최소화하고 접근 기록을 관리합니다.</li>
            </ul>
          ),
        },
        {
          id: "cookies",
          title: "쿠키 등 자동 수집 장치의 운영",
          body: (
            <p>
              이곳저곳은 로그인 상태 유지와 화면 설정 저장을 위해 브라우저 저장소(쿠키·로컬스토리지)를 사용합니다. 이
              정보는 서비스 제공 목적으로만 사용하며, 브라우저 설정에서 언제든지 삭제할 수 있습니다. 쿠키를 차단하면
              로그인이 필요한 일부 기능이 제한될 수 있습니다.
            </p>
          ),
        },
        {
          id: "officer",
          title: "개인정보 보호책임자",
          body: (
            <>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>개인정보 보호책임자: 박기남 (이곳저곳 운영)</li>
                <li>문의: namiggo333@gmail.com</li>
              </ul>
              <p>
                개인정보 처리와 관련한 문의·불만·피해 구제 요청은 위 연락처로 접수해 주시면 확인 후 답변드립니다.
              </p>
            </>
          ),
        },
        {
          id: "remedy",
          title: "권익침해 구제 방법",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>개인정보침해 신고센터: privacy.kisa.or.kr / 118</li>
              <li>개인정보 분쟁조정위원회: www.kopico.go.kr / 1833-6972</li>
              <li>대검찰청 사이버수사과: www.spo.go.kr / 1301</li>
              <li>경찰청 사이버안전국: cyberbureau.police.go.kr / 182</li>
            </ul>
          ),
        },
        {
          id: "notice",
          title: "고지의 의무",
          body: (
            <p>
              이 방침의 내용이 추가·삭제·수정되는 경우 시행 최소 7일 전부터 서비스 화면을 통해 공지합니다. 다만 수집
              항목이나 제3자 제공 등 중요한 변경은 30일 전에 알려드립니다.
            </p>
          ),
        },
      ]}
    />
  );
}
