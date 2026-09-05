import { requireMembership, getEffectivePermissions, can } from "@/lib/data/membership";
import { SiteHeader } from "@/components/SiteHeader";

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

  const navItems = [
    { href: "/dashboard", label: "대시보드" },
    { href: "/projects", label: "프로젝트" },
    ...(canUpload ? [{ href: "/upload", label: "엑셀 업로드" }] : []),
    ...(canManageTeam
      ? [
          { href: "/deletion-requests", label: "삭제 승인함" },
          { href: "/team", label: "팀원 관리" },
        ]
      : []),
    ...(canSeeSettings ? [{ href: "/settings/permissions", label: "권한 설정" }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        brandHref="/dashboard"
        brandLabel="P&L"
        brandClassName="bg-accent"
        title={membership.companyName}
        userLabel={membership.displayName ?? membership.email}
        roleLabel={roleLabel[membership.role]}
        isRepresentative={membership.isRepresentative}
        navItems={navItems}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
