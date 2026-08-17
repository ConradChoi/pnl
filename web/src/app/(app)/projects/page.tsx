import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, getEffectivePermissions, can } from "@/lib/data/membership";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const statusStyle: Record<string, string> = {
  진행중: "bg-accent/10 text-accent-deep",
  진행완료: "bg-good/10 text-good",
  진행예정: "bg-muted/10 text-muted",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const membership = await requireMembership();
  const perms = await getEffectivePermissions(membership.companyId, membership.role);
  const canCreate = can(perms, "project_create");

  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, name, status, field, owner_name, created_at")
    .order("created_at", { ascending: false });

  if (status && status !== "전체") query = query.eq("status", status as "진행중");
  if (q) query = query.ilike("name", `%${q}%`);

  const { data: projects } = await query;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">프로젝트</h1>
        {canCreate && (
          <Link href="/projects/new">
            <Button>+ 신규 등록</Button>
          </Link>
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <select
          name="status"
          defaultValue={status ?? "전체"}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs"
        >
          {["전체", "진행중", "진행완료", "진행예정"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="프로젝트명 검색"
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs"
        />
        <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-accent">
          검색
        </button>
      </form>

      {!projects || projects.length === 0 ? (
        <Card className="text-center text-sm text-muted">
          등록된 프로젝트가 없습니다.
          {canCreate && (
            <>
              {" "}
              <Link href="/projects/new" className="text-accent underline">
                지금 등록해보세요
              </Link>
            </>
          )}
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">프로젝트명</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">분야</th>
                <th className="px-4 py-3 font-medium">담당자</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-semibold hover:text-accent">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{p.field ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{p.owner_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
