import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = "https://gzbkpwdnkhsbeygnynbh.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Ymtwd2Rua2hzYmV5Z255bmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTU1ODcsImV4cCI6MjA4NjIzMTU4N30.reLOBC1F2zbMgAD7Z6I6z_D9s37OhDC4b4Gfr-Ltig8";

/**
 * Subdomain cookie configuration.
 *
 * Setting domain to '.oasispureshine.com' allows the auth session (stored
 * as a cookie by supabase-js when using SSR helpers, or as a localStorage
 * item in the browser) to be shared between:
 *   oasispureshine.com          → customer / public site
 *   admin.oasispureshine.com    → admin portal
 *
 * The leading dot is intentional — it instructs the browser to send the
 * cookie to all subdomains.
 *
 * NOTE: This only applies to cookie-based auth (e.g. @supabase/ssr).
 * The default supabase-js client uses localStorage, which is
 * origin-scoped and does NOT cross subdomains. For full subdomain session
 * sharing you should also configure Netlify redirects so both domains hit
 * the same Vite build, or implement a cookie-based auth exchange flow.
 *
 * The auth.storageKey is set to a shared key so that both origins read/write
 * the same localStorage key when served from the same build.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage (default). Works on single-origin.
    persistSession:  true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Shared storage key — both admin and main-domain builds use the same key.
    storageKey: "oasis_auth_token",
    // Cookie options for when @supabase/ssr is used server-side or in
    // Netlify Edge Functions. The domain covers all oasispureshine.com subdomains.
    cookieOptions: {
      domain:   ".oasispureshine.com",
      sameSite: "lax",
      secure:   true,
      maxAge:   4 * 60 * 60, // 4 hours — matches ADMIN_SESSION_MAX_MS
    },
  },
});
