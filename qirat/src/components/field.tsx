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

/**
 * A select, built to sit beside TextField without looking like a different app.
 *
 * The native control, deliberately: it is the one form element that a phone
 * renders better than anything drawn in HTML, and this appears exactly once, on
 * a form somebody fills in on their phone before they trust the product.
 */
export function SelectField({
  name,
  label,
  options,
  defaultValue,
  hint,
  required = true,
  invalid = false,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue ?? ''}
        aria-invalid={invalid || undefined}
        className="mt-1.5 block w-full appearance-none rounded-[8px] border border-line bg-paper-raised px-3 py-2 text-[15px] text-ink aria-[invalid]:border-below-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1 block text-[12px] text-ink-faint">{hint}</span> : null}
    </label>
  );
}
