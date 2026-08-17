import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export default async function AdminCompaniesPage() {
  const supabase = await createClient();
  const { data: companies, error } = await supabase.rpc("admin_list_companies");

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">회원관리 / PNL 데이터 현황</h1>
      <p className="mb-4 text-xs text-muted">
        여기 목록은 사용 현황 메타데이터입니다(실제 금액·항목명 비노출). 특정 회사의 실제
        데이터를 열람하려면 회사명을 클릭하세요 — 열람 시마다 감사 로그에 기록됩니다.
      </p>

      {error && <p className="text-sm text-bad">{error.message}</p>}

      {!companies || companies.length === 0 ? (
        <Card className="text-center text-sm text-muted">등록된 회사가 없습니다.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">회사명</th>
                <th className="px-4 py-3 text-right font-medium">멤버 수</th>
                <th className="px-4 py-3 text-right font-medium">프로젝트 수</th>
                <th className="px-4 py-3 text-right font-medium">거래 건수</th>
                <th className="px-4 py-3 font-medium">가입일</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.company_id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <Link href={`/admin/companies/${c.company_id}`} className="font-semibold text-accent hover:underline">
                      {c.company_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.member_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.project_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.transaction_count}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {new Date(c.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
