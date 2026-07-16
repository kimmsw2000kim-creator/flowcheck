import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import AuthPage from '../pages/AuthPage';

interface AuthModalProps {
  initialMode: 'login' | 'signup';
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

export default function AuthModal({ initialMode, onClose, setActiveTab }: AuthModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const handleAuthSuccess = (tab: string) => {
    // 인증 성공 후 모달을 먼저 닫고 기존 화면 이동 로직을 실행합니다.
    onClose();
    setActiveTab(tab);
  };

  return (
    <dialog
      ref={dialogRef}
      className="auth-modal"
      aria-label={initialMode === 'login' ? '로그인' : '회원가입'}
      onCancel={(event) => {
        // 네이티브 dialog의 Esc 동작과 React 상태를 함께 맞춥니다.
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        // 폼 바깥의 흐려진 배경을 누른 경우에만 닫습니다.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="auth-modal__surface">
        <button type="button" className="auth-modal__close" onClick={onClose} aria-label="인증 창 닫기">
          <X size={20} aria-hidden="true" />
        </button>
        <AuthPage initialMode={initialMode} setActiveTab={handleAuthSuccess} />
      </div>
    </dialog>
  );
}
