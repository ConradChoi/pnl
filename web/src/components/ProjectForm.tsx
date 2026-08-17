"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { FormError } from "@/components/ui/Card";
import type { ActionResult } from "@/lib/actions/auth";
import type { ProjectStatus } from "@/lib/supabase/types";

type ProjectDefaults = {
  name?: string;
  status?: ProjectStatus;
  field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  owner_name?: string | null;
  note?: string | null;
};

export function ProjectForm<T>({
  action,
  defaults,
  submitLabel,
  onSuccess,
}: {
  action: (prevState: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;
  defaults?: ProjectDefaults;
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">프로젝트명 *</Label>
        <Input id="name" name="name" required defaultValue={defaults?.name} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">상태</Label>
          <select
            id="status"
            name="status"
            defaultValue={defaults?.status ?? "진행중"}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="진행중">진행중</option>
            <option value="진행완료">진행완료</option>
            <option value="진행예정">진행예정</option>
          </select>
        </div>
        <div>
          <Label htmlFor="field">분야</Label>
          <Input id="field" name="field" defaultValue={defaults?.field ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">시작일</Label>
          <Input id="start_date" name="start_date" type="date" defaultValue={defaults?.start_date ?? ""} />
        </div>
        <div>
          <Label htmlFor="end_date">종료(예정)일</Label>
          <Input id="end_date" name="end_date" type="date" defaultValue={defaults?.end_date ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="owner_name">담당자</Label>
        <Input id="owner_name" name="owner_name" defaultValue={defaults?.owner_name ?? ""} />
      </div>
      <div>
        <Label htmlFor="note">비고</Label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={defaults?.note ?? ""}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <FormError message={state?.ok === false ? state.error : null} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "저장 중..." : submitLabel}
      </Button>
    </form>
  );
}
