// 極簡靜態伺服器,用來在本機預覽 site/(模擬正式部署)。
// 執行:npm run build 然後 npm run serve:dist,瀏覽器開 http://localhost:8080/
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, normalize } from 'node:path'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'site')
const PORT = 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (path.endsWith('/')) path += 'index.html'
    const file = join(dist, normalize(path))
    if (!file.startsWith(dist)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    const info = await stat(file).catch(() => null)
    if (!info || !info.isFile()) {
      const html = await readFile(join(dist, 'index.html'))
      res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(html)
      return
    }
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }).end(body)
  } catch (e) {
    res.writeHead(500).end(String(e))
  }
})

server.listen(PORT, () => {
  console.log(`靜態預覽伺服器:http://localhost:${PORT}/`)
})
