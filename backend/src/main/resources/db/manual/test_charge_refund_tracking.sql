alter table public.credits_ledger
    add column if not exists test_request_id uuid null;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_credits_ledger_test_request'
    ) then
        alter table public.credits_ledger
            add constraint fk_credits_ledger_test_request
                foreign key (test_request_id)
                references public.test_requests (request_id)
                on delete set null;
    end if;
end $$;

create index if not exists idx_credits_ledger_test_request_type
    on public.credits_ledger (test_request_id, transaction_type);

alter table public.coupon_usage_log
    add column if not exists test_request_id uuid null,
    add column if not exists user_coupon_id uuid null,
    add column if not exists action varchar(20) null;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_coupon_usage_log_test_request'
    ) then
        alter table public.coupon_usage_log
            add constraint fk_coupon_usage_log_test_request
                foreign key (test_request_id)
                references public.test_requests (request_id)
                on delete set null;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_coupon_usage_log_user_coupon'
    ) then
        alter table public.coupon_usage_log
            add constraint fk_coupon_usage_log_user_coupon
                foreign key (user_coupon_id)
                references public.user_coupons (user_coupon_id)
                on delete set null;
    end if;
end $$;

create index if not exists idx_coupon_usage_log_test_request_action
    on public.coupon_usage_log (test_request_id, coupon_type, action);
