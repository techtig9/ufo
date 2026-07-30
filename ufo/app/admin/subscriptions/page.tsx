import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import type { Plan } from '@/lib/types';

export default async function AdminSubscriptionsPage() {
  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from('subscriptions')
    .select('id, user_id, plan, status, credits_remaining, users(email, name)')
    .order('user_id');

  async function overrideSubscription(formData: FormData) {
    'use server';
    const admin = createAdminClient();
    const id = formData.get('id') as string;
    const plan = formData.get('plan') as Plan;
    const status = formData.get('status') as string;

    await admin
      .from('subscriptions')
      .update({ plan, status, credits_remaining: PLAN_MONTHLY_CREDITS[plan] })
      .eq('id', id);

    revalidatePath('/admin/subscriptions');
  }

  return (
    <Panel hover={false} className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-white/40">
          <tr>
            <th className="px-4 py-3 font-normal">User</th>
            <th className="px-4 py-3 font-normal">Plan</th>
            <th className="px-4 py-3 font-normal">Status</th>
            <th className="px-4 py-3 font-normal">Credits</th>
            <th className="px-4 py-3 font-normal">Override</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {subscriptions?.map((s: any) => (
            <tr key={s.id}>
              <td className="px-4 py-3 text-white/60">{s.users?.email}</td>
              <td className="px-4 py-3 capitalize">{s.plan}</td>
              <td className="px-4 py-3 capitalize">{s.status}</td>
              <td className="px-4 py-3">{s.credits_remaining?.toLocaleString()}</td>
              <td className="px-4 py-3">
                <form action={overrideSubscription} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <select name="plan" defaultValue={s.plan} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs">
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                  <select name="status" defaultValue={s.status} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs">
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="canceled">Canceled</option>
                  </select>
                  <Button size="sm" type="submit">Save</Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
