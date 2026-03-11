import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// verify_jwt: FALSE — function performs its own auth check internally.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON in request body' }, 400); }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;

    const adminClient  = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Unauthorized: invalid or expired session' }, 401);

    const { data: callerProfile } = await adminClient.from('users').select('role').eq('id', caller.id).single();
    if ((callerProfile as any)?.role !== 'admin') return json({ error: 'Forbidden: only admins can create staff accounts' }, 403);

    const { email, password, full_name, role, cellphone, employee_number } = body as any;
    const missing: string[] = [];
    if (!email?.trim())     missing.push('email');
    if (!password?.trim())  missing.push('password');
    if (!full_name?.trim()) missing.push('full_name');
    if (!role?.trim())      missing.push('role');
    if (missing.length > 0) return json({ error: `Missing required fields: ${missing.join(', ')}` }, 400);
    if (!['admin', 'employee'].includes(role)) return json({ error: `Invalid role "${role}"` }, 400);
    if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name, role },
    });
    if (createErr) return json({ error: createErr.message }, 400);
    if (!newUser?.user) return json({ error: 'User creation returned no user' }, 500);

    const uid = newUser.user.id;
    const { error: profileErr } = await adminClient.from('users').upsert(
      { id: uid, full_name, email, role, employee_number: employee_number ?? null, cellphone: cellphone ?? null },
      { onConflict: 'id' }
    );
    if (profileErr) {
      await adminClient.auth.admin.deleteUser(uid);
      return json({ error: profileErr.message, detail: 'Profile upsert failed — auth user rolled back' }, 500);
    }

    return json({ user_id: uid, employee_number: employee_number ?? null }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
