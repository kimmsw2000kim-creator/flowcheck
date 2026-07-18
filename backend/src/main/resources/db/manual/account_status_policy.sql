-- 계정 상태가 마지막으로 변경된 시각을 기록합니다.
alter table public.users
    add column if not exists status_changed_at timestamptz;

comment on column public.users.status_changed_at is
    '계정 정지·비활성화·차단·탈퇴 상태가 마지막으로 변경된 시각';

-- 기존 탈퇴 처리는 개인정보 삭제가 아니므로 관리자 차단 상태로 이전합니다.
update public.users
set status = 'BLOCKED', status_changed_at = now()
where status = 'WITHDRAWN';
