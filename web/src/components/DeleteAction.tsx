"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Card";
import type { ActionResult } from "@/lib/actions/auth";

// SERVICE_SPEC 3.1 삭제 role 분기 UI. team_lead 이상은 즉시삭제 확인 모달,
// member는 사유 입력 후 승인 요청 모달 — 실제 허용 여부는 항상 DB(RLS/RPC)가 최종 판단한다.
export function DeleteAction({
  mode,
  label = "삭제",
  onConfirm,
  onRequest,
}: {
  mode: "direct" | "request";
  label?: string;
  onConfirm?: () => Promise<ActionResult>;
  onRequest?: (reason: string) => Promise<ActionResult>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    setError(null);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const handleDirectDelete = () => {
    startTransition(async () => {
      const result = await onConfirm!();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
    });
  };

  const handleRequest = () => {
    if (!reason.trim()) {
      setError("삭제 사유를 입력해주세요.");
      return;
    }
    startTransition(async () => {
      const result = await onRequest!(reason.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="text-xs font-semibold text-bad hover:underline"
      >
        {mode === "direct" ? label : "삭제 요청"}
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg backdrop:bg-black/40"
      >
        {mode === "direct" ? (
          <>
            <h2 className="mb-2 text-sm font-bold">정말 삭제하시겠습니까?</h2>
            <p className="mb-4 text-xs text-muted">이 작업은 되돌릴 수 없습니다.</p>
            <FormError message={error} />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                취소
              </Button>
              <Button type="button" variant="danger" disabled={pending} onClick={handleDirectDelete}>
                {pending ? "삭제 중..." : "삭제"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-sm font-bold">삭제 승인 요청</h2>
            <p className="mb-3 text-xs text-muted">
              팀 대표(또는 관리자) 승인 후 실제로 삭제됩니다.
            </p>
            <textarea
              className="w-full rounded-lg border border-border bg-surface p-2 text-sm outline-none focus:border-accent"
              rows={3}
              placeholder="삭제 사유를 입력해주세요"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <FormError message={error} />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                취소
              </Button>
              <Button type="button" disabled={pending} onClick={handleRequest}>
                {pending ? "요청 중..." : "삭제 요청"}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
