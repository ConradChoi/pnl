import Link from "next/link";
import { requireMembership, getEffectivePermissions, can } from "@/lib/data/membership";
import { logout } from "@/lib/actions/auth";

const roleLabel: Record<string, string> = {
  owner: "오너",
  admin: "관리자",
  team_lead: "팀 대표",
  member: "팀원",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireMembership();
  const perms = await getEffectivePermissions(membership.companyId, membership.role);
  const canManageTeam = membership.role !== "member";
  const canSeeSettings = membership.role === "owner" || can(perms, "company_settings");
  const canUpload = can(perms, "excel_upload");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
                P&L
              </span>
              <span className="text-sm font-bold">{membership.companyName}</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/dashboard" className="hover:text-foreground">
                대시보드
              </Link>
              <Link href="/projects" className="hover:text-foreground">
                프로젝트
              </Link>
              {canUpload && (
                <Link href="/upload" className="hover:text-foreground">
                  엑셀 업로드
                </Link>
              )}
              {canManageTeam && (
                <>
                  <Link href="/deletion-requests" className="hover:text-foreground">
                    삭제 승인함
                  </Link>
                  <Link href="/team" className="hover:text-foreground">
                    팀원 관리
                  </Link>
                </>
              )}
              {canSeeSettings && (
                <Link href="/settings/permissions" className="hover:text-foreground">
                  권한 설정
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>
              {membership.displayName ?? membership.email} · {roleLabel[membership.role]}
              {membership.isRepresentative && " · 대표"}
            </span>
            <form action={logout}>
              <button type="submit" className="hover:text-foreground hover:underline">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
