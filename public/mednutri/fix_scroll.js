const fs = require('fs');
const cssFile = 'C:/Users/Utente/Desktop/LOGISTICA_CONSEGNE_MC/MedNutri_Pro/style.css';
let css = fs.readFileSync(cssFile, 'utf8');

css = css.replace(/body \{[\s\S]*?\}/, `body {
    font-family: 'Outfit', sans-serif;
    background: linear-gradient(135deg, #f1f5f9 0%, #e0f2fe 100%);
    color: var(--text-main);
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    margin: 0;
}`);

css = css.replace(/\.app-container \{[\s\S]*?\}/, `.app-container {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
}`);

css = css.replace(/\.sidebar \{[\s\S]*?\}/, `.sidebar {
    width: 280px;
    height: 100%;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 24px;
    box-shadow: 5px 0 15px rgba(0,0,0,0.02);
    z-index: 10;
}`);

css = css.replace(/\.main-content \{[\s\S]*?\}/, `.main-content {
    flex: 1;
    height: 100%;
    padding: 32px 40px;
    overflow-y: auto;
}`);

fs.writeFileSync(cssFile, css, 'utf8');
console.log('CSS fixed for double scrollbar and sidebar height');
