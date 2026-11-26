# Sticky Math

Tarayıcıda oynanan matematik aksiyon oyunu. Sayılar defter sayfasında oyuncuya doğru yürür; işlem kartlarıyla onları **sıfıra** indirirsin.

## Nasıl oynanır

- **Tıkla / dokun (basılı tut):** seçili işlemi fırlat. Mermi kayarak gider, sayı çarptığı anda değişir.
- **1–5, Q/E, fare tekerleği veya kartlar:** işlem seç.
  - `−1`, `+1`: sınırsız
  - `÷2`: sayfa başına 12 (çift sayıda **tam bölme**)
  - `√`: sayfa başına 6 (tam karede **tam kök**)
  - `±`: sayfa başına 6 (işareti çevirir)
- **Zıt sayılar birbirini çeker.** `7` ile `−7` çarpışınca **sıfıra birleşir** (en büyük ödül).
- Temiz hamleler (sıfırlama, tam kök, tam bölme, sıfıra birleşme) **kombo** zinciri kurar. Dağınık hamle (tek sayıyı bölmek gibi) komboyu bozar.
- Sayı oyuncuya ulaşırsa can gider. Her temizlenen sayfa +1 can ve bonus RP verir.
- `Esc` / `P`: mola.

## Yayınlama

Derleme gerekmez. `index.html`, `style.css` ve `game.js` dosyalarını sunucuda herhangi bir klasöre koyman yeterli (ör. `dorukplays.com/stickymath/`). Tüm yollar görelidir.

Yerelde denemek için:

```
python -m http.server 8765
```

ve `http://localhost:8765` adresini aç. `?debug` parametresi test için `window.__sm` kancasını açar.
