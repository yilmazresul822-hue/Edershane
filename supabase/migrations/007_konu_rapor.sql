alter table deneme add column if not exists kazanim_id int references kazanim(id);

-- Veli bağlama (siz): önce veli normal kayıt olur, sonra:  select veli_bagla('VELI_ID','OGRENCI_ID');
create or replace function veli_bagla(veli uuid, ogr uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'yetkisiz'; end if;
  update profiles set rol = 'veli' where id = veli and rol <> 'admin';
  update profiles set veli_id = veli where id = ogr;
end $$;
revoke all on function veli_bagla(uuid, uuid) from public;
grant execute on function veli_bagla(uuid, uuid) to authenticated;

create or replace function cocuklarim() returns table (id uuid, ad text)
language sql security definer stable set search_path = public as $$
  select p.id, p.ad from profiles p where p.veli_id = auth.uid()
$$;
revoke all on function cocuklarim() from public;
grant execute on function cocuklarim() to authenticated;

create or replace function haftalik_rapor(ogr uuid, gun int default 7) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  g int := least(greatest(gun, 1), 90);
  bas timestamptz := now() - make_interval(days => least(greatest(gun, 1), 90));
  r jsonb;
begin
  if not (ogr = auth.uid() or is_admin()
          or exists (select 1 from profiles where id = ogr and veli_id = auth.uid())) then
    raise exception 'yetkisiz';
  end if;
  select jsonb_build_object(
    'ad', (select ad from profiles where id = ogr),
    'gun', g,
    'toplam', count(*),
    'dogru', count(*) filter (where dogru),
    'ort_sure_sn', coalesce(round(avg(sure_sn)), 0),
    'calisilan_gun', count(distinct (zaman at time zone 'Europe/Istanbul')::date),
    'hata_tipleri', coalesce((select jsonb_object_agg(t, c) from (
        select hata_tipi t, count(*) c from deneme
        where ogrenci_id = ogr and zaman >= bas and not dogru and hata_tipi is not null group by 1) x), '{}'::jsonb),
    'kazanimlar', coalesce((select jsonb_agg(jsonb_build_object('kazanim', k.kazanim, 'deneme', y.n, 'dogru', y.d) order by y.n desc)
        from (select kazanim_id, count(*) n, count(*) filter (where dogru) d from deneme
              where ogrenci_id = ogr and zaman >= bas and kazanim_id is not null group by 1) y
        join kazanim k on k.id = y.kazanim_id), '[]'::jsonb),
    'tekrar_vakti', (select count(*) from ustalik where ogrenci_id = ogr and sonraki_tekrar <= now()),
    'defter_acik', (select count(*) from yanlis_defteri where ogrenci_id = ogr and not cozuldu)
  ) into r
  from deneme where ogrenci_id = ogr and zaman >= bas;
  return r;
end $$;
revoke all on function haftalik_rapor(uuid, int) from public;
grant execute on function haftalik_rapor(uuid, int) to authenticated;
