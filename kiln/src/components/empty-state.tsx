/**
 * Empty states are instructions, not decoration. Each one says what will put
 * something here, in the words of the thing the reader is trying to do.
 */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-line-strong bg-surface p-8 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
