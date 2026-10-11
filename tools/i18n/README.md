# Interface text

`en.py`, `ru.py`, `es.py` hold every string as a Python dict `M` (the source of truth). `build.py` writes:
- `extension/_locales/<lang>/messages.json` (Chrome's format: the extension name, description and commands come from here), and
- `extension/lib/msgs/<lang>.js` (the same text, which `lib/i18n.js` uses so Tabatha can switch language itself).

```
cd tools/i18n
for l in en ru es; do python3 build.py $l ../../extension/_locales/$l/messages.json; done
```

Counted phrases use keys ending in `_one`, `_few`, `_many`, `_other` (Russian needs all four, English and Spanish `_one`/`_other`). `$1`, `$2` are the values filled in. Every key in `en.py` must exist in `ru.py` and `es.py`. The Russian and Spanish texts were written by Claude: have a native speaker check them.
