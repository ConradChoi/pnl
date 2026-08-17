"use client";

import { useRef, useState, useTransition } from "react";
import { decideDeletionRequest } from "@/lib/actions/deletions";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Card";

export function DecisionButtons({ requestId, isSelf }: { requestId: string; isSelf: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isSelf) {
    return <p className="text-xs text-muted">본인이 요청한 건은 본인이 승인/반려할 수 없습니다.</p>;
  }

  const approve = () => {
    startTransition(async () => {
      const result = await decideDeletionRequest(requestId, true, "");
      if (!result.ok) setError(result.error);
    });
  };

  const openReject = () => {
    setError(null);
    dialogRef.current?.showModal();
  };

  const reject = () => {
    startTransition(async () => {
      const result = await decideDeletionRequest(requestId, false, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      dialogRef.current?.close();
    });
  };

  return (
    <div>
      <FormError message={error} />
      <div className="flex gap-2">
        <Button disabled={pending} onClick={approve}>
          {pending ? "처리 중..." : "승인"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={openReject}>
          반려
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg backdrop:bg-black/40"
      >
        <h2 className="mb-2 text-sm font-bold">반려 사유</h2>
        <textarea
          className="w-full rounded-lg border border-border bg-surface p-2 text-sm outline-none focus:border-accent"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="반려 사유를 입력해주세요"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            취소
          </Button>
          <Button type="button" variant="danger" disabled={pending} onClick={reject}>
            반려
          </Button>
        </div>
      </dialog>
    </div>
  );
}
