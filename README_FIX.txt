Ersetze deine Datei `static/styles.css` durch diese.
Wichtige Änderungen:
- `.bar` hat jetzt `position: relative;` + `z-index:1` (damit wirkt z-index überhaupt).
- `.day .dnum` hat `z-index:10`, `pointer-events:none`, `text-shadow`.

Danach auf Render: Manual Deploy → Clear build cache & deploy, Seite mit Strg/Cmd+F5 neu laden.
