"use client";

import { useEffect, useState, useTransition } from "react";
import { useActionState } from "react";
import { upsertNotice, deleteNotice } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, FormError } from "@/components/ui/Card";
import type { Database } from "@/lib/supabase/types";

type Notice = Database["public"]["Tables"]["notices"]["Row"];

export function NoticesClient({ notices }: { notices: Notice[] }) {
  const [editing, setEditing] = useState<Notice | "new" | null>(null);

  return (
    <div>
      {editing ? (
        <Card className="mb-4">
          <NoticeForm notice={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        </Card>
      ) : (
        <Button className="mb-4" onClick={() => setEditing("new")}>
          + 새 공지
        </Button>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">제목</th>
              <th className="px-4 py-3 font-medium">게시 상태</th>
              <th className="px-4 py-3 font-medium">작성일</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {notices.map((n) => (
              <NoticeRow key={n.id} notice={n} onEdit={() => setEditing(n)} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function NoticeRow({ notice, onEdit }: { notice: Notice; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">{notice.title}</td>
      <td className="px-4 py-3">
        <span className={notice.is_published ? "text-good" : "text-muted"}>
          {notice.is_published ? "게시중" : "비공개"}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {new Date(notice.created_at).toLocaleDateString("ko-KR")}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2 text-xs">
          <button className="text-accent hover:underline" onClick={onEdit}>
            수정
          </button>
          <button
            className="text-bad hover:underline"
            disabled={pending}
            onClick={() => startTransition(async () => { await deleteNotice(notice.id); })}
          >
            삭제
          </button>
        </div>
      </td>
    </tr>
  );
}

function NoticeForm({ notice, onDone }: { notice: Notice | null; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(upsertNotice, null);

  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {notice && <input type="hidden" name="id" value={notice.id} />}
      <div>
        <Label htmlFor="title">제목 *</Label>
        <Input id="title" name="title" required defaultValue={notice?.title} />
      </div>
      <div>
        <Label htmlFor="content">내용 *</Label>
        <textarea
          id="content"
          name="content"
          rows={4}
          required
          defaultValue={notice?.content}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_published" defaultChecked={notice?.is_published ?? true} />
        게시(발행)
      </label>
      <FormError message={state?.ok === false ? state.error : null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          취소
        </Button>
      </div>
    </form>
  );
}
