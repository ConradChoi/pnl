"use client";

import { useState, useTransition } from "react";
import { updateRolePermissions, resetRolePermissions } from "@/lib/actions/settings";
import { Button } from "@/components/ui/Button";
import { Card, FormError } from "@/components/ui/Card";
import type { RolePermissionSet } from "@/lib/supabase/types";

type RoleKey = "admin" | "team_lead" | "member";

const DEFAULTS: Record<RoleKey, RolePermissionSet> = {
  admin: {
    project_create: true,
    project_update: true,
    project_delete: true,
    transaction_create: true,
    transaction_update: true,
    transaction_delete: true,
    excel_upload: true,
    invite_member: true,
    company_settings: true,
  },
  team_lead: {
    project_create: true,
    project_update: true,
    project_delete: true,
    transaction_create: true,
    transaction_update: true,
    transaction_delete: true,
    excel_upload: true,
    invite_member: true,
    company_settings: false,
  },
  member: {
    project_create: false,
    project_update: false,
    project_delete: false,
    transaction_create: true,
    transaction_update: true,
    transaction_delete: false,
    excel_upload: true,
    invite_member: false,
    company_settings: false,
  },
};

const roleLabel: Record<RoleKey, string> = { admin: "관리자", team_lead: "팀 대표", member: "팀원" };

const itemLabel: Record<keyof RolePermissionSet, string> = {
  project_create: "프로젝트 생성",
  project_update: "프로젝트 수정",
  project_delete: "프로젝트 삭제(즉시)",
  transaction_create: "거래내역 생성",
  transaction_update: "거래내역 수정",
  transaction_delete: "거래내역 삭제(즉시)",
  excel_upload: "엑셀 업로드",
  invite_member: "팀원 초대",
  company_settings: "회사 설정",
};

export function PermissionMatrixClient({
  initial,
  customizedRoles,
}: {
  initial: Record<RoleKey, RolePermissionSet | null>;
  customizedRoles: RoleKey[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {(Object.keys(roleLabel) as RoleKey[]).map((role) => (
        <RoleCard
          key={role}
          role={role}
          initial={initial[role] ?? DEFAULTS[role]}
          isCustomized={customizedRoles.includes(role)}
        />
      ))}
    </div>
  );
}

function RoleCard({
  role,
  initial,
  isCustomized,
}: {
  role: RoleKey;
  initial: RolePermissionSet;
  isCustomized: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof RolePermissionSet) => {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: !v[key] }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateRolePermissions(role, values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  const reset = () => {
    setError(null);
    startTransition(async () => {
      const result = await resetRolePermissions(role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValues(DEFAULTS[role]);
      setSaved(true);
    });
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">{roleLabel[role]}</h2>
        {isCustomized && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent-deep">
            커스텀 적용중
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {(Object.keys(itemLabel) as (keyof RolePermissionSet)[]).map((key) => (
          <label key={key} className="flex items-center justify-between">
            <span>{itemLabel[key]}</span>
            <input type="checkbox" checked={values[key]} onChange={() => toggle(key)} />
          </label>
        ))}
      </div>
      <FormError message={error} />
      {saved && !error && <p className="mt-2 text-xs text-good">저장되었습니다.</p>}
      <div className="mt-4 flex gap-2">
        <Button disabled={pending} onClick={save}>
          저장
        </Button>
        <Button variant="secondary" disabled={pending} onClick={reset}>
          기본값 복원
        </Button>
      </div>
    </Card>
  );
}
