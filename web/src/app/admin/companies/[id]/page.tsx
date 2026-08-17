import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

const roleLabel: Record<string, string> = {
  owner: "오너",
  admin: "관리자",
  team_lead: "팀 대표",
  member: "팀원",
};

export default async function AdminCompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "members" } = await searchParams;

  return (
    <div>
      <p className="mb-1 text-xs">
        <Link href="/admin/companies" className="text-accent hover:underline">
          ← 회사 목록
        </Link>
      </p>
      <h1 className="mb-4 text-lg font-bold">회사 상세 열람</h1>

      <div className="mb-4 flex gap-2 text-xs">
        <TabLink id={id} tab="members" current={tab} label="멤버" />
        <TabLink id={id} tab="projects" current={tab} label="프로젝트" />
        <TabLink id={id} tab="transactions" current={tab} label="거래내역" />
      </div>

      <Card className="mb-3 bg-accent/5 text-xs text-accent-deep">
        이 화면 조회는 감사 로그에 자동 기록됩니다 (열람 전용 — 수정·삭제 불가).
      </Card>

      {tab === "members" && <MembersTab companyId={id} />}
      {tab === "projects" && <ProjectsTab companyId={id} />}
      {tab === "transactions" && <TransactionsTab companyId={id} />}
    </div>
  );
}

async function MembersTab({ companyId }: { companyId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_company_members", { p_company_id: companyId });
  if (error) return <p className="text-sm text-bad">{error.message}</p>;

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">이름</th>
            <th className="px-4 py-3 font-medium">이메일</th>
            <th className="px-4 py-3 font-medium">role</th>
            <th className="px-4 py-3 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((m) => (
            <tr key={m.membership_id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                {m.display_name ?? "—"}
                {m.is_representative && <span className="ml-1 text-xs text-accent">· 대표</span>}
              </td>
              <td className="px-4 py-3 text-muted">{m.email}</td>
              <td className="px-4 py-3">{roleLabel[m.role]}</td>
              <td className="px-4 py-3">{m.status === "active" ? "활성" : "비활성"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

async function ProjectsTab({ companyId }: { companyId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_company_projects", { p_company_id: companyId });
  if (error) return <p className="text-sm text-bad">{error.message}</p>;

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">프로젝트명</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">담당자</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">{p.name}</td>
              <td className="px-4 py-3">{p.status}</td>
              <td className="px-4 py-3 text-muted">{p.owner_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

async function TransactionsTab({ companyId }: { companyId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_company_transactions", { p_company_id: companyId });
  if (error) return <p className="text-sm text-bad">{error.message}</p>;

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">날짜</th>
            <th className="px-4 py-3 font-medium">구분</th>
            <th className="px-4 py-3 font-medium">카테고리</th>
            <th className="px-4 py-3 text-right font-medium">금액</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">{t.tx_date}</td>
              <td className="px-4 py-3">{t.kind}</td>
              <td className="px-4 py-3">{t.category}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {t.amount.toLocaleString("ko-KR")} {t.currency}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function TabLink({ id, tab, current, label }: { id: string; tab: string; current: string; label: string }) {
  const active = tab === current;
  return (
    <Link
      href={`/admin/companies/${id}?tab=${tab}`}
      className={`rounded-full px-3 py-1.5 font-semibold ${
        active ? "bg-accent text-white" : "border border-border text-muted hover:border-accent"
      }`}
    >
      {label}
    </Link>
  );
}
