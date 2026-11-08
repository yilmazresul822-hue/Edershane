create extension if not exists vector;

create table profiles (
  id uuid primary key references auth.users,
  rol text check (rol in ('ogrenci','veli','admin')) not null,
  ad text, dogum_yili int,
  veli_id uuid references profiles(id),
  olusturma timestamptz default now()
);

create table veli_onay (            -- KVKK, 18 yaş altı
  ogrenci_id uuid references profiles(id),
  veli_id uuid references profiles(id),
  onay_zamani timestamptz, surum text,
  primary key (ogrenci_id, veli_id)
);

create table abonelik (
  ogrenci_id uuid primary key references profiles(id),
  durum text check (durum in ('deneme','aktif','bitti')),
  bitis timestamptz, manuel_aktif boolean default false
);

create table kazanim (               -- konu > alt konu > kazanım
  id serial primary key, sinav text, ders text,
  konu text, alt_konu text, kazanim text
);

create table kaynak (                -- yalnızca admin
  id serial primary key, tur text, baslik text,
  sahip text, izin_durumu text,
  eklenme timestamptz default now()
);

create table kavram_notu (           -- öğretmenin beslendiği tek yer
  id serial primary key, kaynak_id int references kaynak(id),
  kazanim_id int references kazanim(id),
  icerik text, embedding vector(768)
);

create table tohum_soru (            -- ÖĞRENCİYE GİTMEZ
  id serial primary key, kaynak_id int references kaynak(id),
  kazanim_id int references kazanim(id), sablon jsonb
);

create table uretilen_soru (         -- öğrencinin gördüğü
  id uuid primary key default gen_random_uuid(),
  tohum_id int references tohum_soru(id),
  kazanim_id int references kazanim(id),
  govde jsonb, cevap jsonb, cozum jsonb,
  zorluk real, dogrulandi boolean default false,
  hash text unique
);

create table deneme (
  id bigserial primary key, ogrenci_id uuid references profiles(id),
  soru_id uuid references uretilen_soru(id),
  dogru boolean, sure_sn int, hata_tipi text
    check (hata_tipi in ('kavram','islem','dikkat','sure')),
  zaman timestamptz default now()
);

create table yanlis_defteri (
  id bigserial primary key, ogrenci_id uuid references profiles(id),
  soru_id uuid references uretilen_soru(id),
  kazanim_id int references kazanim(id), hata_tipi text,
  cozuldu boolean default false, zaman timestamptz default now()
);

create table ustalik (               -- Elo + FSRS
  ogrenci_id uuid, kazanim_id int, elo real default 1000,
  stabilite real, zorluk real, sonraki_tekrar timestamptz,
  primary key (ogrenci_id, kazanim_id)
);

create table baski_siparisi (
  id bigserial primary key, ogrenci_id uuid references profiles(id),
  pdf_yolu text, adres jsonb,
  durum text default 'bekliyor'
);
