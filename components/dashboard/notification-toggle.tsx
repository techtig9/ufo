'use client';

export function NotificationToggle({
  action,
  name,
  label,
  description,
  defaultChecked,
}: {
  action: (formData: FormData) => void;
  /** Column name on `users` this switch controls. */
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
}) {
  return (
    <form action={action} className="mt-4">
      <label className="flex items-start justify-between gap-4 text-sm">
        <span>
          <span className="text-fg-secondary">{label}</span>
          {description && <span className="mt-0.5 block text-xs text-fg-faint">{description}</span>}
        </span>
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="mt-0.5 h-4 w-4 shrink-0 accent-studio-citron"
        />
      </label>
    </form>
  );
}
