-- 백엔드 실행 전에 Supabase SQL Editor에서 실행합니다.
alter table public.users
    add column if not exists nickname varchar(20);

-- 기존 Supabase 메타데이터에서 유효하고 중복되지 않은 닉네임만 1회 이전합니다.
with nickname_candidates as (
    select
        public_user.user_id,
        btrim(auth_user.raw_user_meta_data ->> 'nickname') as nickname,
        row_number() over (
            partition by lower(btrim(auth_user.raw_user_meta_data ->> 'nickname'))
            order by public_user.user_id
        ) as duplicate_order
    from public.users public_user
    join auth.users auth_user on auth_user.id = public_user.user_id
    where public_user.nickname is null
      and char_length(btrim(auth_user.raw_user_meta_data ->> 'nickname')) between 2 and 20
      and btrim(auth_user.raw_user_meta_data ->> 'nickname') ~ '^[가-힣A-Za-z0-9_]+$'
)
update public.users public_user
set nickname = candidate.nickname
from nickname_candidates candidate
where public_user.user_id = candidate.user_id
  and candidate.duplicate_order = 1;

alter table public.users
    drop constraint if exists users_nickname_check;

alter table public.users
    add constraint users_nickname_check
    check (
        nickname is null
        or (
            char_length(btrim(nickname)) between 2 and 20
            and nickname = btrim(nickname)
            and nickname ~ '^[가-힣A-Za-z0-9_]+$'
        )
    );

create unique index if not exists users_nickname_lower_unique
    on public.users (lower(nickname))
    where nickname is not null;

-- 기존 사용자 생성 트리거가 public.users를 만든 뒤 실행되도록 이름을 zz로 시작합니다.
create or replace function public.sync_user_nickname_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    -- 길이를 검증하기 전 원문을 담을 수 있도록 text를 사용합니다.
    candidate text;
begin
    candidate := btrim(new.raw_user_meta_data ->> 'nickname');

    if char_length(candidate) between 2 and 20
       and candidate ~ '^[가-힣A-Za-z0-9_]+$' then
        update public.users
        set nickname = candidate
        where user_id = new.id
          and nickname is null;
    end if;

    return new;
exception
    when unique_violation then
        -- 가입 직전 중복 요청이 경합하면 계정 생성은 유지하고 닉네임만 비워 둡니다.
        return new;
end;
$$;

drop trigger if exists zz_flowcheck_sync_user_nickname on auth.users;

create trigger zz_flowcheck_sync_user_nickname
    after insert or update of raw_user_meta_data on auth.users
    for each row execute function public.sync_user_nickname_from_auth();
