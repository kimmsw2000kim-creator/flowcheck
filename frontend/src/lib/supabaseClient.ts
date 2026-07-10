import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseJwtKey = import.meta.env.SUPABASE_JWT_KEY;

if (!supabaseUrl) {
    throw new Error("SUPABASE_URL이 설정되지 않았습니다.");
}

if (!supabaseJwtKey) {
    throw new Error("SUPABASE_JWT_KEY가 설정되지 않았습니다.");
}

export const supabase = createClient(supabaseUrl, supabaseJwtKey);