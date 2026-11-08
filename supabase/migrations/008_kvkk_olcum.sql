create table if not exists olcum (
  id bigserial primary key,
  ogrenci_id uuid default auth.uid(),
  tur text not null check (length(tur) <= 40),
  deger real,
  meta jsonb check (meta is null or length(meta::text) <= 500),
  zaman timestamptz not null default now()
);
alter table olcum enable row level security;
create policy "olcum ekle" on olcum for insert to authenticated with check (ogrenci_id = auth.uid());
create policy "olcum admin oku" on olcum for select to authenticated using (is_admin());

-- KVKK: silme hakkı (sırayla, bağımlılıkları temizler)
create or replace function hesabimi_sil() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  delete from olcum where ogrenci_id = uid;
  delete from baski_siparisi where ogrenci_id = uid;
  delete from yanlis_defteri where ogrenci_id = uid;
  delete from deneme where ogrenci_id = uid;
  delete from ustalik where ogrenci_id = uid;
  delete from veli_onay where ogrenci_id = uid or veli_id = uid;
  delete from abonelik where ogrenci_id = uid;
  update profiles set veli_id = null where veli_id = uid;
  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end $$;
revoke all on function hesabimi_sil() from public;
grant execute on function hesabimi_sil() to authenticated;

-- KVKK: erişim hakkı (verilerimi indir)
create or replace function verilerim() returns jsonb
language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'profil', (select to_jsonb(p) - 'id' from profiles p where p.id = auth.uid()),
    'denemeler', coalesce((select jsonb_agg(to_jsonb(d)) from deneme d where d.ogrenci_id = auth.uid()), '[]'),
    'defter', coalesce((select jsonb_agg(to_jsonb(y)) from yanlis_defteri y where y.ogrenci_id = auth.uid()), '[]'),
    'ustalik', coalesce((select jsonb_agg(to_jsonb(u)) from ustalik u where u.ogrenci_id = auth.uid()), '[]'))
$$;
revoke all on function verilerim() from public;
grant execute on function verilerim() to authenticated;

-- Beta özeti (yalnızca admin):  select * from beta_ozet(14);
create or replace function beta_ozet(gun int default 14)
returns table (tur text, adet bigint, ortalama numeric, medyan numeric, p90 numeric)
language sql security definer stable set search_path = public as $$
  select o.tur, count(*), round(avg(o.deger)::numeric, 2),
    round((percentile_cont(0.5) within group (order by o.deger))::numeric, 2),
    round((percentile_cont(0.9) within group (order by o.deger))::numeric, 2)
  from olcum o
  where is_admin() and o.zaman >= now() - make_interval(days => least(greatest(gun, 1), 90))
  group by o.tur order by o.tur
$$;
revoke all on function beta_ozet(int) from public;
grant execute on function beta_ozet(int) to authenticated;
