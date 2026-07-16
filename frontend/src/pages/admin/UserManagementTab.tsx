import { useEffect, useState } from 'react';
import { activateUser, changeUserRole, fetchAdminUsers, suspendUser, withdrawUser } from '../../api/adminApi';
import type { AdminUser } from '../../api/adminApi';
import { Badge, Button, Card, EmptyState, Select, Table, TableContainer } from '../../components/common';
import type { BadgeTone } from '../../components/common';
import { useAlertStore } from '../../store/alertStore';

const statusTone: Record<string, BadgeTone> = { ACTIVE: 'success', SUSPENDED: 'warning', WITHDRAWN: 'danger' };
const statusLabel: Record<string, string> = { ACTIVE: '활성', SUSPENDED: '정지', WITHDRAWN: '탈퇴' };

export default function UserManagementTab() {
  const showAlert = useAlertStore((state) => state.showAlert);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const selectedUser = users.find((user) => user.userId === selectedUserId) || null;

  useEffect(() => {
    fetchAdminUsers()
      .then(setUsers)
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : '회원 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const updateUser = async (action: string, request: () => Promise<AdminUser>) => {
    setPendingAction(action);
    try {
      const updated = await request();
      setUsers((current) => current.map((user) => user.userId === updated.userId ? updated : user));
      showAlert('회원 정보가 변경되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '회원 정보를 변경하지 못했습니다.', 'error');
    } finally { setPendingAction(''); }
  };

  return (
    <div className="admin-user-grid">
      <Card as="section">
        <h2 className="utility-card-title">회원 목록</h2>
        {loading && <EmptyState title="회원 목록을 불러오는 중입니다." description="잠시만 기다려 주세요." />}
        {!loading && errorMessage && <EmptyState title={errorMessage} description="잠시 후 다시 시도해 주세요." />}
        {!loading && !errorMessage && users.length === 0 && <EmptyState title="등록된 회원이 없습니다." description="회원이 가입하면 이곳에 표시됩니다." />}
        {!loading && !errorMessage && users.length > 0 && <TableContainer><Table density="compact">
          <thead><tr><th>이메일</th><th>역할</th><th>상태</th><th>가입일</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.userId}>
            <td><button type="button" className="admin-user-trigger" onClick={() => setSelectedUserId(user.userId)}>{user.email}</button></td>
            <td><Badge tone={user.role === 'ADMIN' ? 'info' : 'neutral'}>{user.role}</Badge></td>
            <td><Badge tone={statusTone[user.status] || 'neutral'}>{statusLabel[user.status] || user.status}</Badge></td>
            <td>{user.createdAt}</td>
          </tr>)}</tbody>
        </Table></TableContainer>}
      </Card>
      <Card as="aside">
        <h2 className="utility-card-title">회원 상세</h2>
        {!selectedUser ? <EmptyState title="회원을 선택해 주세요." description="회원 이메일을 선택하면 상세 정보가 표시됩니다." /> : <>
          <dl className="admin-detail-list">
            <dt>이메일</dt><dd>{selectedUser.email}</dd>
            <dt>가입일</dt><dd>{selectedUser.createdAt}</dd>
            <dt>잔액</dt><dd>{selectedUser.balance.toLocaleString()}P</dd>
            <dt>쿠폰</dt><dd>{selectedUser.couponCount}개</dd>
            <dt>상태</dt><dd><Badge tone={statusTone[selectedUser.status] || 'neutral'}>{statusLabel[selectedUser.status] || selectedUser.status}</Badge></dd>
          </dl>
          <Select label="권한" value={selectedUser.role} disabled={Boolean(pendingAction)} onChange={(event) => updateUser('role', () => changeUserRole(selectedUser.userId, event.target.value as 'USER' | 'ADMIN'))}>
            <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
          </Select>
          <div className="admin-actions">
            {selectedUser.status === 'ACTIVE' && <Button variant="secondary" isLoading={pendingAction === 'suspend'} loadingText="처리 중..." disabled={Boolean(pendingAction)} onClick={() => updateUser('suspend', () => suspendUser(selectedUser.userId))}>정지 처리</Button>}
            {selectedUser.status === 'SUSPENDED' && <Button variant="secondary" isLoading={pendingAction === 'activate'} loadingText="처리 중..." disabled={Boolean(pendingAction)} onClick={() => updateUser('activate', () => activateUser(selectedUser.userId))}>정지 해제</Button>}
            {selectedUser.status !== 'WITHDRAWN' && <Button variant="danger" isLoading={pendingAction === 'withdraw'} loadingText="처리 중..." disabled={Boolean(pendingAction)} onClick={() => updateUser('withdraw', () => withdrawUser(selectedUser.userId))}>탈퇴 처리</Button>}
            {selectedUser.status === 'WITHDRAWN' && <Button variant="secondary" isLoading={pendingAction === 'activate'} loadingText="처리 중..." disabled={Boolean(pendingAction)} onClick={() => updateUser('activate', () => activateUser(selectedUser.userId))}>탈퇴 해제</Button>}
            <Button variant="ghost" disabled={Boolean(pendingAction)} onClick={() => setSelectedUserId(null)}>닫기</Button>
          </div>
        </>}
      </Card>
    </div>
  );
}
