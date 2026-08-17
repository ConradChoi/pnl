"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpForInvite, acceptInvitationAction, logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, FormError } from "@/components/ui/Card";

export function InviteAcceptForm({
  token,
  inviteEmail,
  currentUserEmail,
}: {
  token: string;
  inviteEmail: string;
  currentUserEmail: string | null;
}) {
  // 로그인 상태인데 이메일이 다름 — 초대 이메일로 로그인해야 함(accept_invitation의 이메일 일치 검증과 동일 규칙)
  if (currentUserEmail && currentUserEmail.toLowerCase() !== inviteEmail.toLowerCase()) {
    return (
      <Card className="text-center">
        <p className="mb-4 text-sm">
          이 초대는 <b>{inviteEmail}</b> 앞으로 온 것입니다.
          <br />
          현재 <b>{currentUserEmail}</b>로 로그인되어 있습니다.
        </p>
        <form action={logout}>
          <Button type="submit" variant="secondary" className="w-full">
            로그아웃하고 {inviteEmail}로 로그인
          </Button>
        </form>
      </Card>
    );
  }

  // 로그인 상태이고 이메일도 일치 — 바로 수락
  if (currentUserEmail) {
    return <AcceptButton token={token} />;
  }

  // 비로그인 — 이미 계정이 있으면 로그인, 없으면 비밀번호 설정 후 가입
  return <SignUpOrLoginChoice token={token} inviteEmail={inviteEmail} />;
}

function AcceptButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <Card>
      <FormError message={error} />
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvitationAction(token);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/dashboard");
          })
        }
      >
        {pending ? "처리 중..." : "초대 수락하기"}
      </Button>
    </Card>
  );
}

function SignUpOrLoginChoice({ token, inviteEmail }: { token: string; inviteEmail: string }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [state, formAction, pending] = useActionState(signUpForInvite, null);

  if (state?.ok) {
    return (
      <Card className="text-center">
        <div className="mb-2 text-3xl">📧</div>
        <p className="text-sm">
          <b>{inviteEmail}</b>로 인증 메일을 보냈습니다. 메일의 링크를 클릭하면 자동으로 팀에
          합류됩니다.
        </p>
      </Card>
    );
  }

  if (mode === "login") {
    return (
      <Card className="text-center">
        <p className="mb-4 text-sm">
          <b>{inviteEmail}</b> 계정으로 이미 가입되어 있다면 로그인해주세요. 로그인 후 이 페이지로
          돌아오면 초대를 수락할 수 있습니다.
        </p>
        <Link href={`/login?next=/invite/${token}`}>
          <Button className="w-full">로그인하러 가기</Button>
        </Link>
        <button
          type="button"
          className="mt-3 text-xs text-muted underline"
          onClick={() => setMode("signup")}
        >
          처음 가입하시나요? 비밀번호 설정하고 가입
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="email" value={inviteEmail} />
        <div>
          <Label>이메일</Label>
          <Input value={inviteEmail} disabled />
        </div>
        <div>
          <Label htmlFor="password">비밀번호 설정</Label>
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
          {pending ? "처리 중..." : "가입하고 초대 수락"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted underline"
          onClick={() => setMode("login")}
        >
          이미 계정이 있으신가요? 로그인
        </button>
      </form>
    </Card>
  );
}
