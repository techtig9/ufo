import { createClient } from '@/lib/supabase/server';
import { DesignerWorkspace } from '@/components/generator/designer-workspace';

export default async function AIDesignerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user!.id)
    .single();

  const canImport = subscription?.plan !== 'free';

  return <DesignerWorkspace canImport={canImport} />;
}
