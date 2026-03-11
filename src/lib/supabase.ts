import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     ?? "https://gzbkpwdnkhsbeygnynbh.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Ymtwd2Rua2hzYmV5Z255bmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTU1ODcsImV4cCI6MjA4NjIzMTU4N30.reLOBC1F2zbMgAD7Z6I6z_D9s37OhDC4b4Gfr-Ltig8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    storageKey:         "oasis_auth_token",
  },
});
