import { createClient } from '@/lib/supabase/server';
import { GeneratorForm } from '@/components/generator/generator-form';

export default async function AIDesignerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user!.id)
    .single();

  const canImport = subscription?.plan !== 'free';

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-8 text-center text-2xl font-semibold">AI Designer</h1>
      <GeneratorForm canImport={canImport} />
    </div>
  );
}
