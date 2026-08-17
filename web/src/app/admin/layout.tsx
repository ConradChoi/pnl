import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/data/admin";
import { logout } from "@/lib/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin/settings" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-deep text-xs font-bold text-white">
                ADMIN
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/admin/settings" className="hover:text-foreground">
                운영 설정
              </Link>
              <Link href="/admin/companies" className="hover:text-foreground">
                회원관리 / PNL 현황
              </Link>
              <Link href="/admin/notices" className="hover:text-foreground">
                공지사항
              </Link>
              <Link href="/admin/faqs" className="hover:text-foreground">
                FAQ
              </Link>
              {admin.canViewAuditLog && (
                <Link href="/admin/audit-log" className="hover:text-foreground">
                  감사 로그
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>
              {admin.email} · {admin.role === "super_admin" ? "최고 관리자" : "운영자"}
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
