import React, { useState } from "react";
import { login, signup } from "../api/authApi";
import { supabase } from "../lib/supabaseClient";

interface AuthPageProps {
  setActiveTab: (tab: string) => void;
  onLoginSuccess: (email: string, token: string) => void;
  showAlert: (message: string, type?: string) => void;
  initialMode?: "login" | "signup";
}

export default function AuthPage({ setActiveTab, onLoginSuccess, showAlert, initialMode = "login" }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);

  const googleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "http://localhost:5173",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      showAlert(err.message || "구글 로그인에 실패했습니다.", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "login") {
      try {
        const data = await login({ email, password });
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("email", data.email);

        onLoginSuccess(data.email, data.accessToken);
        showAlert("로그인에 성공했습니다!", "success");
        setActiveTab("dashboard");
      } catch (error) {
        showAlert("로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.", "error");
        console.error(error);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const data = await signup({ email, password, nickname });
        showAlert(data.message || "회원가입에 성공했습니다! 로그인해 주세요.", "success");
        setMode("login");
        setPassword("");
      } catch (error) {
        showAlert("회원가입에 실패했습니다. 형식에 맞게 다시 입력해 주세요.", "error");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ maxWidth: "450px", margin: "4rem auto", padding: "2rem" }} className="card">
      {/* Tab Switcher Headers */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => { setMode("login"); }}
          style={{
            flex: 1,
            padding: "0.85rem",
            background: "none",
            border: "none",
            borderBottom: mode === "login" ? "2px solid var(--accent)" : "none",
            color: mode === "login" ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: mode === "login" ? 700 : 500,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "1rem"
          }}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); }}
          style={{
            flex: 1,
            padding: "0.85rem",
            background: "none",
            border: "none",
            borderBottom: mode === "signup" ? "2px solid var(--accent)" : "none",
            color: mode === "signup" ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: mode === "signup" ? 700 : 500,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "1rem"
          }}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">이메일 주소</label>
          <input
            className="form-input"
            type="email"
            placeholder="example@flowcheck.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">비밀번호</label>
          <input
            className="form-input"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {mode === "signup" && (
          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label className="form-label">닉네임</label>
            <input
              className="form-input"
              type="text"
              placeholder="사용하실 닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </div>
        )}

        <button className="btn btn-primary" style={{ width: "100%", padding: "0.85rem", marginTop: "1rem" }} type="submit" disabled={loading}>
          {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입 완료"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
        <button className="btn btn-secondary" type="button" onClick={googleLogin} style={{ width: "100%", padding: "0.85rem" }}>
          Google 계정 연동 로그인
        </button>
      </div>
    </div>
  );
}
