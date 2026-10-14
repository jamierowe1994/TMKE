/* Whose account this is, and where its designs and planned posts live.

   A member's live in user_designs and calendar_items, under their own login.
   The TRAINING account is not a login, so it could not save a design, plan a
   post or write a caption. Its work lives in training_designs and
   training_calendar_items instead (supabase/training_designs.sql,
   supabase/training_planner.sql), written with Dani's admin login --
   danielle@tmke.co.uk, the only login those tables let in. Dani, 12 Oct: no
   fake account in the CRM, and nothing a clean-up of the browser could wipe.
   The Planner has its own training table so practice posts never send a
   reminder email and never appear in Dani's own Planner.

   Every page that saves, lists or plans asks here rather than assuming:

     const store = await designStore();     // or plannerStore()
     if (!store) ...                        // nobody signed in
     if (store.blocked) ... store.reason    // training, without Dani's login
     store.db.from(store.table)...          // stamp rows with store.uid
     fetch(..., { Authorization: 'Bearer ' + store.token })

   The admin login is read from its own slot (tmke-admin-auth) by a second
   client, so the training account's hub pages still see nobody signed in --
   the demo stays a demo -- while its work is kept against Dani. */
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
  'To save in the training account, sign in to the admin centre as danielle@tmke.co.uk in this browser, then come back.';

/* The account in use: a member, the training account (through Dani's
   login), or nobody. */
/* Inside a walkthrough's training window (BaseLayout) nothing is saved at
   all, and Dani's admin login is not reached for: the window is sealed from
   this browser's logins, and a client on the admin slot would share its
   sign-out channel with her real admin tabs. */
export const TRAINING_WINDOW_NOTE = "This is the training demo, so nothing you do here is saved.";
export async function account() {
  try {
    if (typeof window !== 'undefined' && window.__TMKE_TRAINING_WINDOW__) {
      return { training: true, blocked: true, reason: TRAINING_WINDOW_NOTE };
    }
    if (isTrainingDemo()) {
      if (!url || !anonKey) return { training: true, blocked: true, reason: TRAINING_SIGN_IN };
      const db = trainingDb();
      const { data } = await db.auth.getSession();
      const session = data && data.session;
      const email = String((session && session.user && session.user.email) || '').toLowerCase();
      if (!session || email !== TRAINER) return { training: true, blocked: true, reason: TRAINING_SIGN_IN };
      return { training: true, blocked: false, db, uid: session.user.id, token: session.access_token };
    }
    const { data } = await supabase.auth.getSession();
    const session = data && data.session;
    if (!session) return null;
    return { training: false, blocked: false, db: supabase, uid: session.user.id, token: session.access_token };
  } catch (_) {
    return null;
  }
}

export async function designStore() {
  const a = await account();
  if (!a || a.blocked) return a;
  return Object.assign({}, a, { table: a.training ? 'training_designs' : 'user_designs' });
}

export async function plannerStore() {
  const a = await account();
  if (!a || a.blocked) return a;
  return Object.assign({}, a, { table: a.training ? 'training_calendar_items' : 'calendar_items' });
}
