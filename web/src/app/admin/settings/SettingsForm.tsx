"use client";

import { useActionState } from "react";
import { updatePlatformSettings } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, FormError } from "@/components/ui/Card";
import type { Database } from "@/lib/supabase/types";

type Settings = Database["public"]["Tables"]["platform_settings"]["Row"] | null;

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updatePlatformSettings, null);

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <h2 className="mb-2 text-sm font-bold">사업자 정보</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="business_name">상호</Label>
              <Input id="business_name" name="business_name" defaultValue={settings?.business_name ?? ""} />
            </div>
            <div>
              <Label htmlFor="representative_name">대표자</Label>
              <Input
                id="representative_name"
                name="representative_name"
                defaultValue={settings?.representative_name ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="business_registration_number">사업자등록번호</Label>
              <Input
                id="business_registration_number"
                name="business_registration_number"
                defaultValue={settings?.business_registration_number ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="business_address">주소</Label>
              <Input id="business_address" name="business_address" defaultValue={settings?.business_address ?? ""} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold">고객센터</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="support_email">이메일</Label>
              <Input id="support_email" name="support_email" type="email" defaultValue={settings?.support_email ?? ""} />
            </div>
            <div>
              <Label htmlFor="support_phone">전화</Label>
              <Input id="support_phone" name="support_phone" defaultValue={settings?.support_phone ?? ""} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold">개인정보 보호책임자</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dpo_name">성명</Label>
              <Input id="dpo_name" name="dpo_name" defaultValue={settings?.dpo_name ?? ""} />
            </div>
            <div>
              <Label htmlFor="dpo_contact">연락처</Label>
              <Input id="dpo_contact" name="dpo_contact" defaultValue={settings?.dpo_contact ?? ""} />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="company_withdrawal_policy">회사 탈퇴 시 데이터 보관/파기 정책</Label>
          <textarea
            id="company_withdrawal_policy"
            name="company_withdrawal_policy"
            rows={4}
            defaultValue={settings?.company_withdrawal_policy ?? ""}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <FormError message={state?.ok === false ? state.error : null} />
        {state?.ok && <p className="text-xs text-good">저장되었습니다.</p>}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "저장 중..." : "저장"}
        </Button>
      </form>
    </Card>
  );
}
