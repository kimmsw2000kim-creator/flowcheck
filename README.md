# flowcheck

## Supabase 비밀번호 재설정 URL 설정

비밀번호 재설정 메일이 올바른 화면으로 돌아오도록 Supabase Dashboard의
`Authentication > URL Configuration`에서 다음 값을 등록합니다.

- Site URL: `https://flowcheck.kr`
- Redirect URLs:
  - `http://localhost:5173/reset-password`
  - `https://flowcheck.kr/reset-password`

운영 도메인이 변경되면 Site URL과 운영 Redirect URL을 실제 주소로 함께 변경합니다.
이메일 템플릿을 직접 수정한 경우에는 링크가 `{{ .SiteURL }}`이 아니라
`{{ .RedirectTo }}`를 사용하도록 확인합니다.

## 닉네임 정책

닉네임 기능을 사용하기 전에 Supabase SQL Editor에서
`backend/src/main/resources/db/manual/user_nickname.sql`을 실행해야 합니다.
닉네임은 2~20자의 한글, 영문, 숫자, 밑줄만 사용할 수 있으며 대소문자를 구분하지 않고 중복을 막습니다.
SQL은 기존 Supabase 회원 메타데이터의 유효한 닉네임을 `public.users`로 이전하고,
새 이메일 회원가입 시 닉네임을 동기화하는 트리거를 설치합니다.

## 계정 상태 정책

- `ACTIVE`: 정상 이용 계정
- `SUSPENDED`: 관리자가 7일 동안 정지한 계정이며, 만료 후 자동으로 활성화됨
- `DEACTIVATED`: 사용자가 직접 비활성화한 계정이며, 다음 로그인 때 본인이 재활성화 가능
- `BLOCKED`: 관리자가 차단한 계정이며, 관리자만 차단 해제 가능
- `WITHDRAWN`: 실제 회원탈퇴 처리용 예약 상태

계정 상태 기능을 사용하기 전에 Supabase SQL Editor에서
`backend/src/main/resources/db/manual/account_status_policy.sql`을 실행해야 합니다.
이 SQL은 기존 `WITHDRAWN` 계정을 관리자 해제가 가능한 `BLOCKED` 상태로 한 번 이전합니다.

## 추후 구현: 실제 회원탈퇴

현재의 사용자 메뉴는 데이터 삭제가 아닌 **계정 비활성화** 기능입니다. 실제 회원탈퇴는 다음 작업을 별도 기능으로 구현합니다.

1. Supabase Auth 사용자를 백엔드의 관리자 권한으로 삭제합니다. `service_role` 키는 프론트엔드에 노출하지 않습니다.
2. 법적 보관 의무가 없는 프로필·커뮤니티 개인정보는 삭제하거나 식별할 수 없도록 익명화합니다.
3. 결제·계약 기록은 관련 법령과 서비스 개인정보처리방침에서 정한 기간만 별도로 보관한 뒤 파기합니다. 문의·분쟁 기록도 정해진 보관 기간을 적용합니다.
4. Supabase Storage의 `avatars` 버킷에서 해당 사용자의 프로필 이미지 파일을 삭제합니다.
5. 재가입 허용 시점, 탈퇴 철회 기간, 동일 이메일 재사용 정책을 정하고 자동 테스트를 추가합니다.

> 참고: 일반적인 전자상거래 기준은 계약·결제 기록 5년, 소비자 불만·분쟁 기록 3년이지만 실제 적용 전 개인정보처리방침과 관련 법령을 다시 확인해야 합니다.
