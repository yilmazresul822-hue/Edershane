-- 001'de RLS açılmamış kalan iki tablo: yalnızca kendi satırları
alter table veli_onay enable row level security;
alter table baski_siparisi enable row level security;
create policy "veli onay oku" on veli_onay for select using (ogrenci_id = auth.uid() or veli_id = auth.uid());
create policy "siparis oku" on baski_siparisi for select using (ogrenci_id = auth.uid());
-- (ekleme/güncelleme yalnızca sunucu tarafından yapılacak; şimdilik politika yok = kimse yazamaz)

-- Kontrol: RLS kapalı tablo kalmadığını doğrulayın (sonuç boş olmalı):
-- select tablename from pg_tables where schemaname = 'public' and not rowsecurity;
