-- Atomically replace the caller's Top 5 (restaurants need not be reviewed)
create or replace function public.rv_set_top5(ids text[])
returns void language plpgsql security invoker set search_path = public as $$
declare i int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if cardinality(ids) > 5 then raise exception 'max 5'; end if;
  delete from rv_top5 where user_id = auth.uid();
  for i in 1 .. coalesce(cardinality(ids),0) loop
    insert into rv_top5(user_id, position, restaurant_id) values (auth.uid(), i, ids[i]);
  end loop;
end $$;
revoke execute on function public.rv_set_top5 from anon, public;
grant execute on function public.rv_set_top5 to authenticated;
