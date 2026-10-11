import { createClient } from "@supabase/supabase-js";
import "../supabase/config.js";

const config = window.RK_SUPABASE_CONFIG || {};

export const isSupabaseConfigured = Boolean(
  config.url &&
    config.anonKey &&
    !config.url.includes("PASTE_") &&
    !config.anonKey.includes("PASTE_")
);

export const supabase = isSupabaseConfigured
  ? createClient(config.url, config.anonKey)
  : null;
