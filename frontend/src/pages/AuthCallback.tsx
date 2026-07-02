import { useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function AuthCallback() {
    useEffect(() => {
        const handleCallback = async () => {
            const { data, error } = await supabase.auth.getSession();

            if (error || !data.session) {
                alert("구글 로그인에 실패했습니다.");
                window.location.href = "/login";
                return;
            }

            localStorage.setItem("accessToken", data.session.access_token);
            localStorage.setItem("refreshToken", data.session.refresh_token);
            localStorage.setItem("email", data.session.user.email || "");

            window.location.href = "/";
        };

        handleCallback();
    }, []);

    return <p>로그인 처리 중입니다...</p>;
}