-- A report should be deliberate, so admins have something to act on: pick a category, explain what happened (at least 15
-- characters), one open report per person per target, and no more than 5 reports per person per day.
set search_path = zcm, public;

alter table zcm.reports add column category text;
alter table zcm.reports add constraint reports_category_check
  check (category in ('Scam or fraud', 'Rude, abusive or threatening', 'Fake or misleading listing',
                      'Unsafe, illegal or prohibited item', 'Spam', 'Something else'));
-- new reports must have a category and a real explanation (NOT VALID: older rows are left alone)
alter table zcm.reports add constraint reports_deliberate_check
  check (category is not null and char_length(btrim(reason)) >= 15) not valid;
create unique index reports_one_open_per_target on zcm.reports (reporter_id, target_type, target_id) where status = 'open';

create function zcm.reports_before_insert() returns trigger
language plpgsql security definer set search_path = zcm as $$
begin
  if (select count(*) from reports where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'You have sent several reports today. Please wait a while, an admin will look at them.';
  end if;
  return new;
end $$;
create trigger reports_limit before insert on zcm.reports for each row execute function zcm.reports_before_insert();
revoke all on function zcm.reports_before_insert() from public, anon, authenticated;
