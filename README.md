# Sticky Math

Tarayıcıda oynanan matematik aksiyon oyunu. Sayılar defter sayfasında çöp adamı kovalar; işlem kalemleriyle onları **sıfıra** indirirsin.

## Kontroller

| | Bilgisayar | Telefon |
|---|---|---|
| Yürü | Yön tuşları / WASD | Ekranın sol yarısı (joystick) |
| Nişan + ateş | Fare (basılı tut) / Space | Ekranın sağ yarısı: dokun = en yakın düşman, sürükle = o yöne |
| Silah seç | 1–3, Q/E, tekerlek, kartlar | Kartlara dokun |
| Mola | Esc / P | II butonu |

## Silahlar

- `−n`, `+n`: sınırsız. Doğru yöne vuruş sıfırı geçmez, sıfırda durur.
- `÷n`: sayıyı böler (kalan atılır).
- `÷` 5 mermiyle başlar, her 20 saniyede 1 mermi dolar.
- Seviye 1'de `−1 +1 ÷2`. Her geliştirme 1 artırır, her silah 30 seviyeye kadar.

## Özel düşmanlar

- **Sıfır tuzağı** (`0`): zarar vermez, kalabalığın arasında dolaşır. `+`/`−` değerse uyanıp düşmana dönüşür; `÷` etkisizdir. Dalga bitince kendiliğinden gider.
- **Mutlak değer** (`|−6|`): iki dikey çizgi zırhtır. Her vuruş bir parça kırar; zırh bitince sayı `|−6| = 6` olur.
- **Üslü sayı** (`2³`, `3²`): ilk vuruşta açılır ve değeri kadar küçük sayıya bölünür (en fazla 9 parça, toplam korunur).
- **Şifacı** (`+1` rozeti): 3 saniyede bir aurasındaki diğer sayıları 1 büyütür. Oyuncudan uzak durur.
- **Kahve lekeli**: leke 10 saniyede yavaş yavaş kurur; kuruyana kadar sayı görünmez ama vurulabilir.

Yeni türler bölümler ilerledikçe açılır (kahve 1. bölümün sonundan, şifacı 4.–5. bölümden itibaren).

## Harita

- Harita **sonsuz**: kamera oyuncuyu takip eder, yürüdükçe defter sayfası uzar. Yeni bölgelere cetvel, pergel ve zımba serpiştirilir.
- Kalem yalnızca **ekranda görünen** sayılara değer. Ekran dışındaki sayılar ve eşyalar kenarda okla gösterilir.
- Tek bölümler **çizgili**, çift bölümler **kareli** defter.
- **Cetvel**: dik durur. Önünden (aşağısından) geçince 1,35 sn sallanır, sonra sana doğru devrilir; altında kalırsan dışarı itilir ve hasar alırsın. Devrilen cetvel duvar olur: oyuncu, düşman ve boss geçemez.
- **Pergel** (2. bölümden itibaren): halkasında 10 saniye durursan (çıkınca dolum geri akar) pergel dönerek bir çember çizer. 8 saniye boyunca çemberdeki sayılar her saniye 5 sıfıra yaklaşır. Sonra 15 saniye dinlenir.
- **Zımba**: yanından geçince 4'ten geri sayar, sonra çat diye iner ve geniş bir alandaki sayıları birbirine zımbalar. Zımbalı sayılar tek sıra hâlinde, %50 yavaş birlikte yürür. 20 saniye sonra yeniden kullanılır.

## Dalga süresi

- Boss olmayan dalgaların süresi var: zorluğa göre 30 saniyeden 10 saniyeye iner.
- Süre bitince yeni dalga hemen başlar; eski dalganın kalan sayıları (ve henüz doğmamışları) 2× hızlanır.
- Boss dalgalarında süre yok.

## Eşyalar ve tek/çift kombosu

- Eşyalar düştükleri yerde kalır, kaybolmaz; gidip almak gerekir.
- Her öldürmede %3 eşya düşme şansı. Nadirlik: Sıradan %60, Nadir %27, Epik %10, Efsanevi %3.
- Eşyalar: Yara bandı, Mürekkep şişesi, Yedek uçlar, Kalemtıraş, Silgi kalkanı; kalemler: Renkli kalem (bir silah +1), Altın dolma kalem (tüm silahlar +1).
- Üst üste 10 tek ya da 10 çift sayı öldürürsen sonuncusundan kesin bir eşya düşer (nadirlik aynı tablodan). 3. öldürmeden sonra oyuncunun üstünde `7 tek kaldı` yazar; kombo bozulursa yazı ve ödül gider. Normal %3 şans bundan etkilenmez. Boss ve üslü sayı parçaları komboya sayılmaz.
- **Asal sayı kombosu**: üst üste 2 pozitif asal sayı öldürünce oyuncunun üstünde `Asal sayı kombosu` yazar. Kombo sürdükçe sonraki her asal sayıdan %100 eşya düşer. Asal olmayan (negatif, 0, 1 dahil) bir öldürme komboyu bozar. Sayının başlangıç değerine bakılır.

## XP ve seviye

Ölen sayılar mor XP damlası bırakır. XP barı dolunca seviye atlarsın ve bir silahı geliştirirsin (+10 can).

## Bölümler ve bosslar

- 20 bölüm, her biri 10 dalga. 5. ve 10. dalgalar silgi bossu.
- Zorluk 1–16 arası yumuşak artar, 17–20 sert sıçrar.
- Bosslar: Şişko, Şapkalı (küçük sayı çağırır), Koşucu (atılır), Öğretmen (hesap makinesi sorusu sorar), Zombi (kendini onarır), Ninja (ışınlanır, kırıntı fırlatır), Hayalet (görünmez olur), İkiz, Kral; 20. bölümün sonunda Dev Silgi.
- Bosslarda ÷ zırhı: tek ÷ vuruşu başlangıç değerinin en fazla %12'sini götürür.
- Bölümü ilk kez geçmek +1 yetenek puanı verir; para her seferinde verilir, ölünce geçilen dalga oranında. İlerleme `localStorage`'da (`sm_save_v1`).

## Yayın

Cloudflare Pages `main` dalını `stickymath.dorukplays.com` adresine yayınlar. Diğer dallar için önizleme adresi: `https://<dal-adı>.stickymath.pages.dev`.

Yerelde denemek için:

```
python -m http.server 8765
```

`?nointro` açılış animasyonunu atlar, `?debug` test için `window.__sm` kancasını açar.

Her yay�nda `index.html` i�indeki `game.js?v=N` ve `style.css?v=N` numaras�n� bir art�r; `_headers` da taray�c�lar�n dosyalar� her a��l��ta yeniden kontrol etmesini sa�lar.
