import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { login, signup } from "../api/authApi";
import { supabase } from "../lib/supabaseClient";

import { useAlertStore } from "../store/alertStore";
import { useUserStore } from "../store/userStore";

interface AuthPageProps {
  setActiveTab: (tab: string) => void;
  initialMode?: "login" | "signup";
}

export default function AuthPage({
  setActiveTab,
  initialMode = "login",
}: AuthPageProps) {
  const showAlert = useAlertStore((state) => state.showAlert);
  const loginSuccess = useUserStore((state) => state.loginSuccess);
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 추가: 비밀번호 확인 state
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);

  // 추가: 비밀번호 일치 여부
  const isPasswordConfirmTouched = passwordConfirm.length > 0;
  const isPasswordMatched = password === passwordConfirm;
  const isPasswordMismatch =
    mode === "signup" && isPasswordConfirmTouched && !isPasswordMatched;

  const googleLogin = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      showAlert(err.message || "구글 로그인에 실패했습니다.", "error");
      setLoading(false);
    }
  };

  const googleSessionHandledRef = useRef(false);

  const completeGoogleLogin = useCallback(
    (session: Session) => {
      if (googleSessionHandledRef.current) return;

      const user = session.user;

      if (!user.email) {
        showAlert("Google 계정에서 이메일 정보를 가져오지 못했습니다.", "error");
        return;
      }

      googleSessionHandledRef.current = true;

      localStorage.setItem("accessToken", session.access_token);
      localStorage.setItem("refreshToken", session.refresh_token);
      localStorage.setItem("email", user.email);
      localStorage.setItem("userId", user.id);

      loginSuccess(user.email, session.access_token, user.id);
      showAlert("Google 계정으로 로그인되었습니다!", "success");
      setActiveTab("dashboard");

      // OAuth redirect 후 URL에 남은 code/hash 제거
      window.history.replaceState({}, document.title, window.location.origin);
    },
    [loginSuccess, setActiveTab, showAlert]
  );

  useEffect(() => {
    const checkGoogleSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error(error);
        return;
      }

      if (data.session) {
        completeGoogleLogin(data.session);
      }
    };

    checkGoogleSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        completeGoogleLogin(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [completeGoogleLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 추가: 회원가입 시 비밀번호 확인 검사
    if (mode === "signup" && password !== passwordConfirm) {
      showAlert("비밀번호가 일치하지 않습니다.", "error");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      try {
        const data = await login({ email, password });
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("email", data.email);

        loginSuccess(data.email, data.accessToken, data.userId);
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
        showAlert(
          data.message || "회원가입 요청이 완료되었습니다. 이메일 인증 후 로그인해 주세요.",
          "success"
        );

        setMode("login");
        setPassword("");
        setPasswordConfirm("");
      } catch (error) {
        showAlert("회원가입에 실패했습니다. 형식에 맞게 다시 입력해 주세요.", "error");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div
      style={{ maxWidth: "450px", margin: "4rem auto", padding: "2rem" }}
      className="card"
    >
      {/* Tab Switcher Headers */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setPasswordConfirm("");
          }}
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
            fontSize: "1rem",
          }}
        >
          로그인
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("signup");
          }}
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
            fontSize: "1rem",
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

        {/* 추가: 회원가입일 때만 비밀번호 확인 입력칸 표시 */}
        {mode === "signup" && (
          <div className="form-group">
            <label className="form-label">비밀번호 확인</label>
            <input
              className="form-input"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              style={{
                borderColor: isPasswordMismatch ? "#ef4444" : undefined,
              }}
            />

            {isPasswordConfirmTouched && (
              <p
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.875rem",
                  color: isPasswordMatched ? "#22c55e" : "#ef4444",
                }}
              >
                {isPasswordMatched
                  ? "비밀번호가 일치합니다."
                  : "비밀번호가 일치하지 않습니다."}
              </p>
            )}
          </div>
        )}

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

        <button
          className="btn btn-primary"
          style={{ width: "100%", padding: "0.85rem", marginTop: "1rem" }}
          type="submit"
          disabled={loading || isPasswordMismatch}
        >
          {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입 완료"}
        </button>
      </form>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginTop: "1.5rem",
          borderTop: "1px solid var(--border)",
          paddingTop: "1.5rem",
        }}
      >
        <button
          className="btn btn-secondary"
          type="button"
          onClick={googleLogin}
          style={{ width: "100%", padding: "0.85rem" }}
        >
          Google 계정 연동 로그인
        </button>
      </div>
    </div>
  );
}