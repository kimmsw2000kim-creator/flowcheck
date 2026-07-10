import { supabase } from "../lib/supabaseClient";

export interface AuthParams {
    email: string;
    password?: string;
    nickname?: string;
}

export async function signup({ email, password, nickname }: AuthParams): Promise<any> {
    if (!password) throw new Error("비밀번호가 필요합니다.");

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                nickname
            },
        },
    });

    if (error) throw new Error(error.message);
    return data;
}

export async function login({ email, password }: AuthParams): Promise<any> {
    if (!password) throw new Error("비밀번호가 필요합니다.");

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw new Error(error.message);
    return data;
}

export async function logout(): Promise<any> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    return;
}
