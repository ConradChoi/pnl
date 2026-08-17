"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpWithCompany } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, FormError } from "@/components/ui/Card";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUpWithCompany, null);

  if (state?.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16 text-center">
        <Card>
          <div className="mb-2 text-3xl">📧</div>
          <h1 className="mb-2 text-base font-bold">인증 메일을 보냈습니다</h1>
          <p className="text-sm text-muted">
            메일함에서 인증 링크를 클릭하면 가입이 완료되고 회사가 생성됩니다.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
          P&L
        </div>
        <h1 className="text-lg font-bold">회원가입 — 새 회사 시작하기</h1>
        <p className="mt-1 text-xs text-muted">
          가입하면 자동으로 오너(대표계정)가 됩니다.
        </p>
      </div>

      <Card>
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="companyName">회사명</Label>
            <Input id="companyName" name="companyName" required placeholder="예: 와이엘아이에이" />
          </div>
          <div>
            <Label htmlFor="email">이메일</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <FormError message={state?.ok === false ? state.error : null} />
          <Button type="submit" disabled={pending}>
            {pending ? "처리 중..." : "회원가입"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-accent">
          로그인
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted">
        동료의 초대를 받으셨나요? 받으신 초대 링크로 접속해주세요.
      </p>
    </main>
  );
}
