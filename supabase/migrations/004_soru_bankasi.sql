create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and rol = 'admin') $$;

-- Başlangıç kazanımları (şablonlardaki kazanim_id'lerle eşleşir)
insert into kazanim (id, sinav, ders, konu, alt_konu, kazanim) values
 (1,'TYT','Matematik','Denklemler','Birinci dereceden denklemler','Bir bilinmeyenli birinci dereceden denklemi çözer'),
 (2,'TYT','Matematik','Denklemler','İkinci dereceden denklemler','İkinci dereceden denklemin köklerini bulur'),
 (3,'AYT','Matematik','Türev','Türev alma','Polinom fonksiyonun bir noktadaki türevini bulur'),
 (4,'TYT','Geometri','Üçgenler','Alan','Kenar uzunluklarından üçgenin alanını hesaplar'),
 (5,'AYT','Matematik','İntegral','Belirsiz/belirli integral','Polinom fonksiyonun integralini hesaplar')
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('kazanim','id'), greatest(100, (select max(id) from kazanim)));

alter table kazanim enable row level security;
create policy "kazanım oku" on kazanim for select to authenticated using (true);

alter table uretilen_soru enable row level security;
create policy "doğrulanmış soru oku" on uretilen_soru for select to authenticated using (dogrulandi);
create policy "admin soru ekler" on uretilen_soru for insert to authenticated with check (is_admin());

-- Yalnızca admin: şablonlar, kaynaklar, kavram notları
alter table tohum_soru enable row level security;
alter table kaynak enable row level security;
alter table kavram_notu enable row level security;
create policy "admin" on tohum_soru for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin" on kaynak for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin" on kavram_notu for all to authenticated using (is_admin()) with check (is_admin());
