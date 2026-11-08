alter table kaynak add column if not exists aktif boolean not null default true;

alter table kavram_notu
  add column if not exists baslik text,
  add column if not exists kaynak_bas_sn int,
  add column if not exists kaynak_bit_sn int,
  add column if not exists benzerlik real,
  add column if not exists onayli boolean not null default false,
  add column if not exists olusturma timestamptz not null default now();

create index if not exists kavram_notu_vec on kavram_notu using hnsw (embedding vector_cosine_ops);

-- Öğrenci notları doğrudan okuyamaz (RLS); yalnızca abone, yalnızca onaylı notun metnini bu fonksiyonla alır
create or replace function not_ara(q vector(768), kz int default null, n int default 4)
returns table (id int, baslik text, icerik text, kazanim_id int, benzerlik float)
language sql security definer stable set search_path = public, extensions as $$
  select k.id, k.baslik, k.icerik, k.kazanim_id, 1 - (k.embedding <=> q)
  from kavram_notu k
  where k.onayli and (kz is null or k.kazanim_id = kz)
    and exists (select 1 from abonelik a where a.ogrenci_id = auth.uid()
                and (a.manuel_aktif or (a.durum in ('deneme','aktif') and a.bitis > now())))
  order by k.embedding <=> q
  limit least(n, 8)
$$;
revoke all on function not_ara(vector, int, int) from public;
grant execute on function not_ara(vector, int, int) to authenticated;

-- Bir kaynağı tek komutla çıkar:  select kaynak_cikar(3);
create or replace function kaynak_cikar(kid int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'yetkisiz'; end if;
  update kaynak set aktif = false where id = kid;
  update kavram_notu set onayli = false where kaynak_id = kid;
  update uretilen_soru set dogrulandi = false
    where tohum_id in (select id from tohum_soru where kaynak_id = kid);
end $$;
revoke all on function kaynak_cikar(int) from public;
grant execute on function kaynak_cikar(int) to authenticated;

-- Kendi hesabınızla öğretmeni denemek için (ID'yi değiştirin):
-- insert into abonelik (ogrenci_id, durum, manuel_aktif) values ('SIZIN_ID','aktif',true)
--   on conflict (ogrenci_id) do update set manuel_aktif = true;
