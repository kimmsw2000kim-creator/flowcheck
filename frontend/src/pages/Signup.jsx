import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../api/authApi";

export default function Signup() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [nickname, setNickname] = useState("");

    const handleSignup = async (e) => {
        e.preventDefault();

        try {
            const data = await signup({ email, password, nickname });
            alert(data.message);
            navigate("/login");
        } catch (error) {
            alert("회원가입 실패");
            console.error(error);
        }
    };

    return (
        <div>
            <h1>회원가입</h1>

            <form onSubmit={handleSignup}>
                <input
                    type="email"
                    placeholder="이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <input
                    type="text"
                    placeholder="닉네임"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                />

                <button type="submit">회원가입</button>
            </form>
        </div>
    );
}