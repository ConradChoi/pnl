import { createClient } from "@/lib/supabase/server";
import { InviteAcceptForm } from "./InviteAcceptForm";
import { Card } from "@/components/ui/Card";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: preview, error }, { data: userData }] = await Promise.all([
    supabase.rpc("get_invitation_preview", { invitation_token: token }),
    supabase.auth.getUser(),
  ]);

  const invite = preview?.[0];

  if (error || !invite) {
    return (
      <ErrorShell message="초대 링크를 찾을 수 없습니다. 링크를 다시 확인해주세요." />
    );
  }
  if (invite.status !== "pending") {
    return <ErrorShell message="이미 처리되었거나 취소된 초대입니다." />;
  }
  if (new Date(invite.expires_at) < new Date()) {
    return <ErrorShell message="초대가 만료되었습니다. 관리자에게 재초대를 요청해주세요." />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
          P&L
        </div>
        <h1 className="text-lg font-bold">{invite.company_name} 팀 초대</h1>
        <p className="mt-1 text-xs text-muted">
          {invite.email} · {roleLabel(invite.role)}로 초대되었습니다
        </p>
      </div>

      <InviteAcceptForm
        token={token}
        inviteEmail={invite.email}
        currentUserEmail={userData.user?.email ?? null}
      />
    </main>
  );
}

function ErrorShell({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16">
      <Card className="text-center">
        <div className="mb-2 text-3xl">⚠️</div>
        <p className="text-sm">{message}</p>
      </Card>
    </main>
  );
}

function roleLabel(role: string) {
  return { admin: "관리자", team_lead: "팀 대표", member: "팀원" }[role] ?? role;
}
