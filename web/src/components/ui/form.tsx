import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const control =
  "block w-full rounded-lg border-0 bg-surface px-3 text-base text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 sm:text-sm";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} min-h-11 ${props.className ?? ""}`} />;
}

/** Native select — the right control on touch devices (parent spec §2.3). */
export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${control} min-h-11 pr-8 ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${control} py-2 ${props.className ?? ""}`} />;
}

/** Big tappable single-choice buttons (status, mood). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T | null;
  options: Array<{ value: T; label: string; tone?: string }>;
  onChange: (value: T) => void;
  name: string;
}) {
  const cols = options.length === 5 ? "grid-cols-5" : options.length === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div role="radiogroup" aria-label={name} className={`grid ${cols} gap-2 sm:flex sm:flex-wrap`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors ${
              active
                ? (o.tone ?? "bg-brand-600 text-white ring-brand-600")
                : "bg-surface text-ink-700 ring-line hover:bg-slate-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
