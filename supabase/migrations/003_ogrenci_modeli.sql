alter table ustalik
  add column if not exists son_tekrar timestamptz,
  add column if not exists deneme_sayisi int not null default 0;

alter table ustalik enable row level security;
alter table deneme enable row level security;
alter table yanlis_defteri enable row level security;

create policy "ustalik oku" on ustalik for select using (ogrenci_id = auth.uid());
create policy "ustalik ekle" on ustalik for insert with check (ogrenci_id = auth.uid());
create policy "ustalik güncelle" on ustalik for update using (ogrenci_id = auth.uid()) with check (ogrenci_id = auth.uid());
create policy "deneme oku" on deneme for select using (ogrenci_id = auth.uid());
create policy "deneme ekle" on deneme for insert with check (ogrenci_id = auth.uid());
create policy "defter oku" on yanlis_defteri for select using (ogrenci_id = auth.uid());
create policy "defter ekle" on yanlis_defteri for insert with check (ogrenci_id = auth.uid());
