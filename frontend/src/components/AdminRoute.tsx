import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

interface AdminRouteProps {
  children: ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const role = useUserStore((state) => state.currentUser.role);
  const normalizedRole = role.trim().toUpperCase();

  // 관리자 역할이 아니면 관리자 화면을 렌더링하지 않습니다.
  if (normalizedRole !== 'ADMIN' && normalizedRole !== 'ROLE_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
