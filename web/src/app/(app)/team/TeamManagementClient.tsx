"use client";

import { useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import {
  inviteMember,
  cancelInvitation,
  resendInvitation,
  updateMemberRole,
  deactivateMember,
  createTeam,
} from "@/lib/actions/team";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, FormError } from "@/components/ui/Card";
import type { Role } from "@/lib/supabase/types";

export type MembershipRow = {
  id: string;
  user_id: string;
  role: Role;
  team_id: string | null;
  is_representative: boolean;
  status: "active" | "inactive";
  profiles: { display_name: string | null; email: string | null } | null;
};

type InvitationRow = {
  id: string;
  email: string;
  role: Role;
  team_id: string | null;
  status: string;
  expires_at: string;
  token: string;
};

type Team = { id: string; name: string };

const roleLabel: Record<Role, string> = {
  owner: "오너",
  admin: "관리자",
  team_lead: "팀 대표",
  member: "팀원",
};
const roleRank: Record<Role, number> = { owner: 4, admin: 3, team_lead: 2, member: 1 };

export function TeamManagementClient({
  currentUserId,
  currentUserRole,
  currentUserTeamId,
  memberships,
  invitations,
  teams,
}: {
  currentUserId: string;
  currentUserRole: Role;
  currentUserTeamId: string | null;
  memberships: MembershipRow[];
  invitations: InvitationRow[];
  teams: Team[];
}) {
  const [inviting, setInviting] = useState(false);
  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const activeOwnerCount = memberships.filter((m) => m.role === "owner" && m.status === "active").length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">팀원 관리</h1>
        <Button onClick={() => setInviting((v) => !v)}>{inviting ? "닫기" : "+ 초대"}</Button>
      </div>

      {inviting && (
        <Card className="mb-4">
          <InviteForm
            currentUserRole={currentUserRole}
            currentUserTeamId={currentUserTeamId}
            teams={teams}
            onDone={() => setInviting(false)}
          />
        </Card>
      )}

      <h2 className="mb-2 text-sm font-bold">구성원</h2>
      <Card className="mb-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium">role</th>
              <th className="px-4 py-3 font-medium">팀</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => {
              const isLastOwner = m.role === "owner" && activeOwnerCount <= 1;
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    {m.profiles?.display_name ?? "—"}
                    {m.user_id === currentUserId && <span className="ml-1 text-xs text-muted">(나)</span>}
                    {m.is_representative && <span className="ml-1 text-xs text-accent">· 대표</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{m.profiles?.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {canManageMembers && m.user_id !== currentUserId && m.role !== "owner" ? (
                      <RoleSelect membershipId={m.id} currentRole={m.role} />
                    ) : (
                      roleLabel[m.role]
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{m.team_id ? teamNameById.get(m.team_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={m.status === "active" ? "text-good" : "text-muted"}>
                      {m.status === "active" ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManageMembers && m.status === "active" && m.user_id !== currentUserId && (
                      <DeactivateButton membershipId={m.id} disabled={isLastOwner} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-2 text-sm font-bold">초대중</h2>
      {invitations.filter((i) => i.status === "pending").length === 0 ? (
        <p className="text-sm text-muted">대기 중인 초대가 없습니다.</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">role</th>
                <th className="px-4 py-3 font-medium">팀</th>
                <th className="px-4 py-3 font-medium">만료</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invitations
                .filter((i) => i.status === "pending")
                .map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3">{roleLabel[inv.role]}</td>
                    <td className="px-4 py-3 text-muted">
                      {inv.team_id ? teamNameById.get(inv.team_id) ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(inv.expires_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InvitationActions invitationId={inv.id} token={inv.token} />
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

function InviteForm({
  currentUserRole,
  currentUserTeamId,
  teams,
  onDone,
}: {
  currentUserRole: Role;
  currentUserTeamId: string | null;
  teams: Team[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(inviteMember, null);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [teamOptions, setTeamOptions] = useState(teams);
  const [creatingTeam, startCreatingTeam] = useTransition();
  const newTeamNameRef = useRef<HTMLInputElement>(null);

  // QA 중 발견: 팀 대표는 자기 팀에만 초대 가능(has_permission 스코핑, 0005 마이그레이션).
  // teams 테이블 쓰기도 오너/관리자 전용이라 "+ 새 팀"도 팀 대표에겐 의미가 없다.
  // 서버가 어차피 막아주지만, 쓸 수 없는 컨트롤을 보여줘서 혼란 주지 않도록 UI에서 미리 잠근다.
  const isTeamLead = currentUserRole === "team_lead";

  const invitableRoles = (Object.keys(roleRank) as Role[]).filter(
    (r) => r !== "owner" && roleRank[r] < roleRank[currentUserRole]
  );

  const [linkCopied, setLinkCopied] = useState(false);

  const handleCreateTeam = () => {
    const name = newTeamNameRef.current?.value.trim();
    if (!name) return;
    const formData = new FormData();
    formData.set("name", name);
    startCreatingTeam(async () => {
      const result = await createTeam(null, formData);
      if (result.ok) {
        setTeamOptions((prev) => [...prev, { id: result.data, name }]);
        setShowNewTeam(false);
      }
    });
  };

  if (state?.ok) {
    const link = inviteLink(state.data);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          초대가 생성됐습니다. 아직 이메일 자동 발송은 연결되어 있지 않으니, 아래 링크를 복사해서
          직접 전달해주세요.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={link} onFocus={(e) => e.target.select()} />
          <Button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setLinkCopied(true);
            }}
          >
            {linkCopied ? "복사됨!" : "링크 복사"}
          </Button>
        </div>
        <Button type="button" variant="secondary" className="self-start" onClick={onDone}>
          닫기
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">이메일 *</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="role">역할 *</Label>
          <select
            id="role"
            name="role"
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {invitableRoles.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="team_id">팀</Label>
        {isTeamLead ? (
          <>
            <input type="hidden" name="team_id" value={currentUserTeamId ?? ""} />
            <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted">
              {teamOptions.find((t) => t.id === currentUserTeamId)?.name ?? "소속 팀"} (본인 팀에만 초대 가능)
            </p>
          </>
        ) : !showNewTeam ? (
          <div className="flex gap-2">
            <select
              id="team_id"
              name="team_id"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">소속 팀 없음</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" onClick={() => setShowNewTeam(true)}>
              + 새 팀
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input ref={newTeamNameRef} placeholder="새 팀 이름" />
            <Button type="button" disabled={creatingTeam} onClick={handleCreateTeam}>
              만들기
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewTeam(false)}>
              취소
            </Button>
          </div>
        )}
      </div>

      <FormError message={state?.ok === false ? state.error : null} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "발송 중..." : "초대 발송"}
      </Button>
    </form>
  );
}

function RoleSelect({ membershipId, currentRole }: { membershipId: string; currentRole: Role }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <select
        defaultValue={currentRole}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const result = await updateMemberRole(membershipId, e.target.value as Role);
            if (!result.ok) setError(result.error);
          })
        }
        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
      >
        <option value="admin">관리자</option>
        <option value="team_lead">팀 대표</option>
        <option value="member">팀원</option>
      </select>
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}

function DeactivateButton({ membershipId, disabled }: { membershipId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending || disabled}
        title={disabled ? "회사에는 최소 1명의 오너가 필요합니다" : undefined}
        className="text-xs text-bad hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() =>
          startTransition(async () => {
            const result = await deactivateMember(membershipId);
            if (!result.ok) setError(result.error);
          })
        }
      >
        비활성화
      </button>
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}

function inviteLink(token: string) {
  return typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;
}

function InvitationActions({ invitationId, token }: { invitationId: string; token: string }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex justify-end gap-2 text-xs">
      <button
        type="button"
        className="text-accent hover:underline"
        onClick={() => {
          navigator.clipboard.writeText(inviteLink(token));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "복사됨!" : "링크 복사"}
      </button>
      <button
        type="button"
        disabled={pending}
        className="text-accent hover:underline"
        onClick={() => startTransition(async () => { await resendInvitation(invitationId); })}
      >
        재발송
      </button>
      <button
        type="button"
        disabled={pending}
        className="text-bad hover:underline"
        onClick={() => startTransition(async () => { await cancelInvitation(invitationId); })}
      >
        취소
      </button>
    </div>
  );
}
