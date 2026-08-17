"use client";

import { useEffect, useState, useTransition } from "react";
import { useActionState } from "react";
import { upsertFaq, deleteFaq } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, FormError } from "@/components/ui/Card";
import type { Database } from "@/lib/supabase/types";

type Faq = Database["public"]["Tables"]["faqs"]["Row"];

export function FaqsClient({ faqs }: { faqs: Faq[] }) {
  const [editing, setEditing] = useState<Faq | "new" | null>(null);

  return (
    <div>
      {editing ? (
        <Card className="mb-4">
          <FaqForm faq={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        </Card>
      ) : (
        <Button className="mb-4" onClick={() => setEditing("new")}>
          + 새 FAQ
        </Button>
      )}

      <div className="flex flex-col gap-2">
        {faqs.map((f) => (
          <Card key={f.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">
                  Q. {f.question}
                  {!f.is_published && <span className="ml-2 text-xs text-muted">(비공개)</span>}
                </p>
                <p className="mt-1 text-sm text-muted">A. {f.answer}</p>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button className="text-accent hover:underline" onClick={() => setEditing(f)}>
                  수정
                </button>
                <DeleteButton id={f.id} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="text-bad hover:underline"
      disabled={pending}
      onClick={() => startTransition(async () => { await deleteFaq(id); })}
    >
      삭제
    </button>
  );
}

function FaqForm({ faq, onDone }: { faq: Faq | null; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(upsertFaq, null);

  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {faq && <input type="hidden" name="id" value={faq.id} />}
      <div>
        <Label htmlFor="question">질문 *</Label>
        <Input id="question" name="question" required defaultValue={faq?.question} />
      </div>
      <div>
        <Label htmlFor="answer">답변 *</Label>
        <textarea
          id="answer"
          name="answer"
          rows={3}
          required
          defaultValue={faq?.answer}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <Label htmlFor="category">카테고리</Label>
        <Input id="category" name="category" defaultValue={faq?.category ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_published" defaultChecked={faq?.is_published ?? true} />
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
