import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
import { supabase } from "../utils/supabase";

export default function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const googleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: "http://localhost:5173",
            },
        });

        if (error) {
            alert(error.message);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const data = await login({ email, password });

            localStorage.setItem("accessToken", data.accessToken);
            localStorage.setItem("refreshToken", data.refreshToken);
            localStorage.setItem("email", data.email);

            alert("로그인 성공");
            navigate("/");
        } catch (error) {
            alert("로그인 실패");
            console.error(error);
        }
    };

    return (
        <div className="card" style={{ maxWidth: "400px", margin: "100px auto" }}>
            <h1 style={{ marginBottom: "20px", textAlign: "center" }}>로그인</h1>

            <form onSubmit={handleLogin}>
                <div className="form-group">
                    <label className="form-label">이메일</label>
                    <input
                        className="form-input"
                        type="email"
                        placeholder="이메일"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">비밀번호</label>
                    <input
                        className="form-input"
                        type="password"
                        placeholder="비밀번호"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <button className="btn btn-primary" type="submit">
                    로그인
                </button>
            </form>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginTop: "20px",
                }}
            >
                <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={googleLogin}
                >
                    Google 로그인
                </button>

                <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => navigate("/signup")}
                >
                    회원가입
                </button>
            </div>
        </div>
    );
}