'use client';

export function NotificationToggle({
  action,
  defaultChecked,
}: {
  action: (formData: FormData) => void;
  defaultChecked: boolean;
}) {
  return (
    <form action={action} className="mt-4">
      <label className="flex items-center justify-between text-sm">
        <span className="text-white/70">Email me when credits run low</span>
        <input
          type="checkbox"
          name="notify_low_credits"
          defaultChecked={defaultChecked}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-4 w-4 accent-studio-citron"
        />
      </label>
    </form>
  );
}
