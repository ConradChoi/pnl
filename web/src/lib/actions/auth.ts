"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

// SERVICE_SPEC 1.1 (a) 신규 회사 생성 경로.
// company_name은 auth 메타데이터에 잠시 보류해뒀다가, 이메일 인증 콜백에서
// create_company_with_owner RPC를 호출해 실제 회사를 만든다.
// (prevState, formData) 시그니처: useActionState와 함께 쓰기 위함.
export async function signUpWithCompany(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();

  if (!email || !password || !companyName) {
    return { ok: false, error: "이메일/비밀번호/회사명을 모두 입력해주세요.", code: "VALIDATION_ERROR" };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { pending_company_name: companyName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    // Supabase는 이미 가입된 이메일에 대해 별도 에러코드를 안 주는 경우가 많아 메시지로 판별
    if (error.message.toLowerCase().includes("already registered")) {
      return { ok: false, error: "이미 가입된 이메일입니다.", code: "EMAIL_TAKEN" };
    }
    return { ok: false, error: error.message, code: "SIGNUP_FAILED" };
  }

  return { ok: true, data: undefined };
}

export async function login(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "이메일과 비밀번호를 입력해주세요.", code: "VALIDATION_ERROR" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다.", code: "INVALID_CREDENTIALS" };
  }

  const next = String(formData.get("next") ?? "").trim();
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// 이메일 인증 콜백 이후, 대기 중이던 작업(신규 회사 생성 또는 초대 수락)을 마무리한다.
export async function finalizePendingSignup(): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;

  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return; // 이미 회사가 있으면(예: 재시도) 건너뜀

  const pendingName = user.user_metadata?.pending_company_name as string | undefined;
  const pendingInviteToken = user.user_metadata?.pending_invite_token as string | undefined;

  if (pendingName) {
    await supabase.rpc("create_company_with_owner", { company_name: pendingName });
    await supabase.auth.updateUser({ data: { pending_company_name: null } });
  } else if (pendingInviteToken) {
    await supabase.rpc("accept_invitation", { invitation_token: pendingInviteToken });
    await supabase.auth.updateUser({ data: { pending_invite_token: null } });
  }
}

// 초대받은 이메일이 아직 계정이 없는 경우: 비밀번호만 설정해서 가입.
// 이메일 인증 콜백에서 pending_invite_token을 보고 자동으로 초대를 수락한다.
export async function signUpForInvite(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const token = String(formData.get("token") ?? "");

  if (!email || !password || !token) {
    return { ok: false, error: "필수 정보가 없습니다.", code: "VALIDATION_ERROR" };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { pending_invite_token: token },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return {
        ok: false,
        error: "이미 가입된 이메일입니다. 로그인 후 다시 초대 링크를 열어주세요.",
        code: "EMAIL_TAKEN",
      };
    }
    return { ok: false, error: error.message, code: "SIGNUP_FAILED" };
  }

  return { ok: true, data: undefined };
}

export async function acceptInvitationAction(token: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { invitation_token: token });

  if (error) {
    if (error.message.includes("이미 다른 회사")) {
      return { ok: false, error: error.message, code: "ALREADY_MEMBER" };
    }
    if (error.message.includes("유효하지 않거나 만료")) {
      return { ok: false, error: error.message, code: "INVITE_EXPIRED" };
    }
    return { ok: false, error: error.message, code: "ACCEPT_FAILED" };
  }

  return { ok: true, data: data as string };
}
