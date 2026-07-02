import { useNavigate } from "react-router-dom";

export default function Home() {
    const navigate = useNavigate();

    const email = localStorage.getItem("email");
    const token = localStorage.getItem("accessToken");

    const logout = () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("email");

        alert("로그아웃 되었습니다.");
        navigate("/login");
    };

    if (!token) {
        return (
            <div>
                <h1>홈</h1>
                <p>로그인이 필요합니다.</p>
                <button onClick={() => navigate("/login")}>로그인</button>
            </div>
        );
    }

    return (
        <div>
            <h1>홈</h1>
            <p>{email}님 로그인 중</p>

            <button onClick={logout}>로그아웃</button>
        </div>
    );
}