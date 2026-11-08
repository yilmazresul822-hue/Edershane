# e-dershane

Yapay zeka öğretmenli matematik/geometri çalışma uygulaması (TYT, AYT, LGS).
Öğrenci PDF/resim açar, soruyu daire içine alır; YZ öğretmen soruyu SymPy ile çözüp tahtaya
el yazısı animasyonuyla anlatır. Yanlışlar deftere düşer, kişisel PDF soru bankası üretilir.

## Yapı
| Klasör | Ne |
|---|---|
| `packages/geometry-core` | dikme, açıortay, açı, etiket yerleşimi, şekil sığdırma |
| `packages/command-schema` | tahta komutlarının tipi ve doğrulayıcısı |
| `packages/board-player` | komutları çizim işlemlerine çeviren derleyici, oynatma saati |
| `packages/voice-core` | konuşma algılama (VAD), diyalog durum makinesi, cümle-saat eşitleme |
| `packages/teacher-core` | öğretmen prompt'ları, betik doğrulama, soru yapılandırma, ders akışı |
| `packages/student-model` | Elo, FSRS, hata sınıflandırma |
| `packages/content-core` | transkript → kavram notu, kaynağa benzerlik kontrolü |
| `packages/bank-pdf` | kişisel soru bankası PDF'i |
| `packages/solver/py` | SymPy çözücü, soru üretici, şablonlar |
| `workers/api` | Cloudflare Worker (öğretmen, soru okuma, kütüphane, deneme kaydı) |
| `apps/web` | React arayüzü (Excalidraw + pdf.js) |
| `supabase/migrations` | veritabanı göçleri (001 → 009, sırayla) |

## Durum
Mantık paketleri ve Worker sandbox'ta test edildi: Python 16, TypeScript 84 test.
**Test EDİLMEDİ:** web arayüzü (Excalidraw, pdf.js, Pyodide, ses), SQL göçleri, PDF üretimi.
İlk çalıştırmada bu parçalarda hata çıkması beklenir.

## İlk çalıştırma (Codespaces)
    npm install
    pip install sympy pytest
    npm test

1. Supabase'te `supabase/migrations/001…009` dosyalarını sırayla SQL editöründe çalıştırın.
2. `workers/api/wrangler.toml` içinde `SUPABASE_URL` ve `ALLOWED_ORIGIN`'i doldurun;
   `wrangler secret put GEMINI_API_KEY` ve `wrangler secret put SUPABASE_ANON_KEY`.
3. `apps/web/.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun.
4. `npm run dev -w apps/web`
5. Kayıt olun; kendinizi yönetici yapın ve abonelik açın:
       update profiles set rol = 'admin' where id = 'SIZIN_ID';
       insert into abonelik (ogrenci_id, durum, manuel_aktif) values ('SIZIN_ID','aktif',true)
         on conflict (ogrenci_id) do update set manuel_aktif = true;
6. Soru havuzu: `cd packages/solver/py && python3 uret.py sablonlar/tyt-temel.json 40 > sorular.sql`
   ve çıkan SQL'i Supabase'te çalıştırın.

## Beta öncesi mutlaka
- Aydınlatma metni ve veli onayını bir hukukçuyla netleştirin (şu an taslak).
- Gemini ücretsiz katman veri şartlarını okuyun; çocuk verisi için ücretli katman gerekebilir.
- `select * from beta_ozet(14);` ile gecikme, okuma doğruluğu ve çözücü hatalarını izleyin.
