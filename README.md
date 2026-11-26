# Sticky Math

Tarayıcıda oynanan matematik aksiyon oyunu. Sayılar defter sayfasında çöp adamı kovalar; işlem kalemleriyle onları **sıfıra** indirirsin.

## Kontroller

| | Bilgisayar | Telefon |
|---|---|---|
| Yürü | Yön tuşları / WASD | Ekranın sol yarısı (joystick) |
| Nişan + ateş | Fare (basılı tut) / Space | Ekranın sağ yarısı: dokun = en yakın düşman, sürükle = o yöne |
| Silah seç | 1–4, Q/E, tekerlek, kartlar | Kartlara dokun |
| Mola | Esc / P | II butonu |

## Silahlar

- `−n`, `+n`: sınırsız. Doğru yöne vuruş sıfırı geçmez, sıfırda durur.
- `÷n`: sayıyı böler (kalan atılır).
- `×n`: sayıyı işaretler; 6 saniye boyunca `+`/`−` vuruşları ×n güçlü.
- `÷` ve `×` 5 mermiyle başlar, her 20 saniyede 1 mermi dolar.
- Seviye 1'de `−1 +1 ÷2 ×2`. Her geliştirme 1 artırır, her silah 30 seviyeye kadar.

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
