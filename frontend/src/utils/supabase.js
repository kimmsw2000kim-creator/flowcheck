import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("SUPABASE URL:", supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase 환경변수가 없습니다. frontend/.env를 확인하세요.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);