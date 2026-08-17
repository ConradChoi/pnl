import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/data/admin";
import { Card } from "@/components/ui/Card";

const resourceLabel: Record<string, string> = {
  members: "멤버",
  projects: "프로젝트",
  transactions: "거래내역",
};

export default async function AuditLogPage() {
  const admin = await requirePlatformAdmin();
  if (!admin.canViewAuditLog) redirect("/admin/settings");

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("platform_admin_access_log")
    .select("id, admin_user_id, company_id, resource, accessed_at, companies(name)")
    .order("accessed_at", { ascending: false })
    .limit(200);

  const adminIds = [...new Set((logs ?? []).map((l) => l.admin_user_id))];
  const { data: admins } = adminIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", adminIds)
    : { data: [] as { id: string; display_name: string | null; email: string | null }[] };
  const adminById = new Map((admins ?? []).map((a) => [a.id, a]));

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">감사 로그</h1>
      <p className="mb-4 text-xs text-muted">
        운영자가 회원관리에서 회사 실데이터를 열람할 때마다 자동 기록됩니다 (최고 관리자 또는
        권한을 부여받은 운영자만 열람 가능).
      </p>

      {!logs || logs.length === 0 ? (
        <Card className="text-center text-sm text-muted">기록이 없습니다.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">시각</th>
                <th className="px-4 py-3 font-medium">운영자</th>
                <th className="px-4 py-3 font-medium">회사</th>
                <th className="px-4 py-3 font-medium">열람 리소스</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const admin = adminById.get(l.admin_user_id);
                const company = Array.isArray(l.companies) ? l.companies[0] : l.companies;
                return (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(l.accessed_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">{admin?.display_name ?? admin?.email ?? l.admin_user_id}</td>
                    <td className="px-4 py-3">{company?.name ?? "—"}</td>
                    <td className="px-4 py-3">{resourceLabel[l.resource] ?? l.resource}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
