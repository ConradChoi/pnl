import { requirePlatformAdmin } from "@/lib/data/admin";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  const navItems = [
    { href: "/admin/settings", label: "운영 설정" },
    { href: "/admin/companies", label: "회원관리 / PNL 현황" },
    { href: "/admin/notices", label: "공지사항" },
    { href: "/admin/faqs", label: "FAQ" },
    ...(admin.canViewAuditLog ? [{ href: "/admin/audit-log", label: "감사 로그" }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        brandHref="/admin/settings"
        brandLabel="ADMIN"
        brandClassName="bg-accent-deep"
        userLabel={admin.email}
        roleLabel={admin.role === "super_admin" ? "최고 관리자" : "운영자"}
        navItems={navItems}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
