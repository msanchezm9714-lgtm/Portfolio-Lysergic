const fs = require('fs'), path = require('path')
const d = 'dist'
let html = fs.readFileSync(d + '/index.html', 'utf8')
const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join('public', f)).toString('base64')
const imgs = { '/assets/hero-dither-boy.png': uri('assets/hero-dither-boy.png'), '/assets/ascii-scene.png': uri('assets/ascii-scene.png') }
const sub = (s) => { for (const [k, v] of Object.entries(imgs)) s = s.split(k).join(v); return s }
const cssFile = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)[1]
const jsFile = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)[1]
const css = fs.readFileSync(d + cssFile, 'utf8')
const js = sub(fs.readFileSync(d + jsFile, 'utf8')).replace(/<\/script/g, '<\\/script')
html = html
  .replace(/<link rel="stylesheet"[^>]*>/, () => '<style>' + css + '</style>')
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, () => '')
  .replace(/<link rel="preload"[^>]*>\n?/, () => '')
  .replace(/<link rel="icon"[^>]*>\n?/, () => '')
  .replace('</body>', () => '<script type="module">' + js + '</script>\n</body>')
fs.mkdirSync('export', { recursive: true })
fs.writeFileSync('export/portfolio.html', html)
console.log((html.length / 1e6).toFixed(2) + ' MB')
