import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = PROJECT_ROOT;
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'content', 'posts');

const PORT = 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// Trigger compilation build script
function runBuild(callback) {
  console.log('\n[REBUILD] Detectado cambio de archivo, recompilando...');
  exec('node scripts/build.js', (err, stdout, stderr) => {
    if (err) {
      console.error(`[ERROR] Error al recompilar: ${err.message}`);
      return;
    }
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    if (callback) callback();
  });
}

// Custom static file HTTP server
const server = http.createServer((req, res) => {
  // Normalize and resolve request path
  let reqPath = req.url.split('?')[0]; // strip query params
  if (reqPath === '/' || reqPath.endsWith('/')) {
    reqPath += 'index.html';
  }

  let filePath = path.join(DIST_DIR, reqPath);
  
  // Security check: ensure path is within the dist directory
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Access Denied');
    return;
  }

  // Check if file exists, if not serve 404
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // If it's an article URL without extension, try appending .html (pretty URLs)
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<h1>404 Not Found</h1><p>El recurso solicitado no existe.</p>');
      return;
    }
  }

  // Read file and serve with correct MIME Type
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end(`Server Error: ${err.code}`);
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
});

// Recursive watch helper to monitor Linux subfolders correctly
function watchRecursive(dir, callback) {
  fs.watch(dir, callback);
  const items = fs.readdirSync(dir);
  for (let item of items) {
    const fullPath = path.join(dir, item);
    try {
      if (fs.statSync(fullPath).isDirectory() && !item.startsWith('.')) {
        watchRecursive(fullPath, callback);
      }
    } catch (e) {
      // ignore broken symlinks or locks
    }
  }
}

// Start development environment
runBuild(() => {
  // Start server listening
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n🚀 Servidor de desarrollo corriendo en: http://localhost:${PORT}`);
    console.log('👀 Vigilando cambios de archivos en src/ y content/posts/...\n');
  });

  // Watch directories
  let rebuildTimeout = null;
  const watchCallback = (eventType, filename) => {
    if (!filename || filename.startsWith('.')) return;
    
    // Debounce triggers to prevent multiple consecutive rapid compilations
    clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(() => {
      runBuild();
    }, 200);
  };

  if (fs.existsSync(SRC_DIR)) watchRecursive(SRC_DIR, watchCallback);
  if (fs.existsSync(CONTENT_DIR)) watchRecursive(CONTENT_DIR, watchCallback);
});
