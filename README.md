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

## Yayın

Cloudflare Pages `main` dalını `stickymath.dorukplays.com` adresine yayınlar. Diğer dallar için önizleme adresi: `https://<dal-adı>.stickymath.pages.dev`.

Yerelde denemek için:

```
python -m http.server 8765
```

`?nointro` açılış animasyonunu atlar, `?debug` test için `window.__sm` kancasını açar.
