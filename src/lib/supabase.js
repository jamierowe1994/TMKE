import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[TMKE] Supabase env vars missing. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env. See ADMIN_SETUP.md.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'tmke-admin-auth',
  },
});

export function gbpFromPence(pence) {
  if (pence == null) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

export function slugify(input) {
  return String(input ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}
