import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export default async function PrivacyPolicyPage() {
  const supabase = await createClient();
  const { data: s } = await supabase.from("platform_settings").select("*").eq("id", true).single();

  const filled = s?.business_name || s?.support_email || s?.dpo_name;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-xl font-bold">개인정보처리방침</h1>

      {!filled ? (
        <Card className="text-sm text-muted">준비 중입니다.</Card>
      ) : (
        <div className="flex flex-col gap-6 text-sm">
          <Section title="사업자 정보">
            <p>상호: {s?.business_name ?? "—"}</p>
            <p>대표자: {s?.representative_name ?? "—"}</p>
            <p>사업자등록번호: {s?.business_registration_number ?? "—"}</p>
            <p>주소: {s?.business_address ?? "—"}</p>
          </Section>
          <Section title="고객센터">
            <p>이메일: {s?.support_email ?? "—"}</p>
            <p>전화: {s?.support_phone ?? "—"}</p>
          </Section>
          <Section title="개인정보 보호책임자">
            <p>성명: {s?.dpo_name ?? "—"}</p>
            <p>연락처: {s?.dpo_contact ?? "—"}</p>
          </Section>
          {s?.company_withdrawal_policy && (
            <Section title="회사 탈퇴 시 데이터 보관/파기 정책">
              <p className="whitespace-pre-line">{s.company_withdrawal_policy}</p>
            </Section>
          )}
          <Section title="서비스 운영자의 열람">
            <p>
              서비스 운영진은 회원 지원 및 서비스 운영 목적으로 회원 계정 정보와 소속 회사의
              프로젝트·거래내역을 열람할 수 있습니다. 이 열람은 누가·언제·어느 회사의 정보를
              조회했는지 별도로 기록·보관되며, 열람 권한이 있는 운영자만 접근할 수 있습니다.
            </p>
          </Section>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-bold">{title}</h2>
      <div className="text-muted">{children}</div>
    </div>
  );
}
