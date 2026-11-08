alter table profiles
  add column if not exists veli_eposta text,
  add column if not exists veli_onay_zamani timestamptz,
  add column if not exists kvkk_onay_zamani timestamptz,
  add column if not exists kvkk_surum text;

alter table profiles enable row level security;
create policy "kendi profilini oku" on profiles for select using (id = auth.uid());

-- Kayıt: rol her zaman 'ogrenci'. 18 yaş altı (yıl farkı < 19, temkinli) veli e-postası ister,
-- hesabı veli onayına kadar kapalı açar.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  yil int := nullif(m->>'dogum_yili','')::int;
  simdi int := extract(year from now())::int;
  yetiskin boolean;
begin
  if yil is null or yil < 1950 or yil > simdi - 5 then raise exception 'dogum_yili geçersiz'; end if;
  if coalesce(m->>'kvkk','') <> 'true' then raise exception 'KVKK onayı gerekli'; end if;
  yetiskin := (simdi - yil) >= 19;
  if not yetiskin and coalesce(m->>'veli_eposta','') = '' then raise exception 'veli e-postası gerekli'; end if;
  insert into profiles (id, rol, ad, dogum_yili, veli_eposta, kvkk_onay_zamani, kvkk_surum)
    values (new.id, 'ogrenci', left(coalesce(m->>'ad',''), 80), yil, nullif(m->>'veli_eposta',''), now(), 'taslak-1');
  insert into abonelik (ogrenci_id, durum, bitis)
    values (new.id, case when yetiskin then 'deneme' else 'bitti' end,
            case when yetiskin then now() + interval '7 days' end);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Veli onayı (siz, SQL editöründen):  select veli_onayla('OGRENCI_ID');
create or replace function veli_onayla(ogr uuid, gun int default 7) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'yetkisiz'; end if;
  update profiles set veli_onay_zamani = now() where id = ogr;
  update abonelik set durum = 'deneme', bitis = now() + make_interval(days => gun)
    where ogrenci_id = ogr and durum = 'bitti';
end $$;
revoke all on function veli_onayla(uuid, int) from public;
grant execute on function veli_onayla(uuid, int) to authenticated;

-- Yanlış defteri: soruyu yeniden çözebilmek için
alter table yanlis_defteri add column if not exists soru_metni text, add column if not exists soru_spec jsonb;
create policy "defter güncelle" on yanlis_defteri for update
  using (ogrenci_id = auth.uid()) with check (ogrenci_id = auth.uid());
