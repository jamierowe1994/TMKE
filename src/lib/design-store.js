/* Where a person's saved designs live.

   A member's are in user_designs, under their own login. The TRAINING
   account is not a login, so it could not save at all; its designs live in
   training_designs instead (supabase/training_designs.sql), written with
   Dani's admin login -- danielle@tmke.co.uk, the only login that table lets
   in. Dani, 12 Oct: no fake account in the CRM, and nothing a clean-up of
   the browser could wipe.

   Every page that lists, opens, saves, files or deletes a design asks here
   rather than assuming, and gets back the client to use, the table, and the
   user id to stamp rows with:

     const store = await designStore();
     if (!store || store.blocked) ... // nobody to save for
     store.db.from(store.table).select(...)

   The admin login is read from its own slot (tmke-admin-auth) by a second
   client, so the training account's hub pages still see nobody signed in --
   the demo stays a demo -- while its designs are kept against Dani. */
import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase.js';
import { isTrainingDemo } from './demo.js';

const TRAINER = 'danielle@tmke.co.uk';
const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

let _trainingDb = null;
function trainingDb() {
  if (_trainingDb) return _trainingDb;
  _trainingDb = createClient(url, anonKey, {
    auth: { storageKey: 'tmke-admin-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return _trainingDb;
}

export const TRAINING_SIGN_IN =
  'To save training designs, sign in to the admin centre as danielle@tmke.co.uk in this browser, then come back.';

export async function designStore() {
  try {
    if (isTrainingDemo()) {
      if (!url || !anonKey) return { training: true, blocked: true, reason: TRAINING_SIGN_IN };
      const db = trainingDb();
      const { data } = await db.auth.getSession();
      const session = data && data.session;
      const email = String((session && session.user && session.user.email) || '').toLowerCase();
      if (!session || email !== TRAINER) return { training: true, blocked: true, reason: TRAINING_SIGN_IN };
      return { training: true, blocked: false, db, table: 'training_designs', uid: session.user.id };
    }
    const { data } = await supabase.auth.getSession();
    const session = data && data.session;
    if (!session) return null;
    return { training: false, blocked: false, db: supabase, table: 'user_designs', uid: session.user.id };
  } catch (_) {
    return null;
  }
}
