import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// PKCE-Flow nötig für Mobile (Android Custom Tab verliert Hash-Fragmente).
// Auth-Code als Query-Parameter wird in Intent erhalten und via exchangeCodeForSession() getauscht.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		flowType: 'pkce',
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
	},
});
