export function TextField({
  name,
  label,
  type = 'text',
  autoComplete,
  required = true,
  defaultValue,
  hint,
  invalid = false,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        // Logical properties throughout: padding-inline, not padding-left, so
        // the form is correct in Arabic without a single RTL override.
        className="mt-1.5 block w-full rounded-[8px] border border-line bg-paper-raised px-3 py-2 text-[15px] text-ink placeholder:text-ink-faint aria-[invalid]:border-below-ink"
      />
      {hint ? <span className="mt-1 block text-[12px] text-ink-faint">{hint}</span> : null}
    </label>
  );
}
