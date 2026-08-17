import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
          P&L
        </div>
        <h1 className="text-lg font-bold">로그인</h1>
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
