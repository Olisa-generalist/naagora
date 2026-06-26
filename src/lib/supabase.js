// src/lib/supabase.js
// ─────────────────────────────────────────────
// One Supabase client for the whole app.
// NEVER import createClient anywhere else —
// always import { supabase } from this file.
//
// Your two keys come from:
// supabase.com → your project → Settings → API
// Copy them into a .env file (see README.md step 3)
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase keys. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. See README.md step 3.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
