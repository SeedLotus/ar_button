/**
 * Object Drum Studio — Electron Desktop Application
 *
 * Starts an embedded HTTP server (127.0.0.1 only), then opens a
 * BrowserWindow. Closes the server when the window quits.
 */

const { app, BrowserWindow } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const DEV = !app.isPackaged;

// --------------- static file server ---------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

const CACHE_CONTROL = DEV
  ? "no-store, no-cache, must-revalidate, max-age=0"
  : "public, max-age=3600";

function injectDevFlag(mime) {
  // 仅在开发模式下，向 HTML 页面注入 window.__ODS_DEV__ = true
  if (!DEV) return "";
  if (mime.startsWith("text/html")) {
    return '<script>window.__ODS_DEV__=true;</script>';
  }
  return "";
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);
  const size = stat.size;

  // Range request support (needed for MediaPipe WASM)
  const range = res.req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": mime,
      "Cache-Control": CACHE_CONTROL,
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
    stream.on("error", () => res.end());
    return;
  }

  // 开发模式：在 HTML 文件末尾注入 __ODS_DEV__ 标志
  const devInject = injectDevFlag(mime);
  let bodyBuf = null;
  if (devInject) {
    const html = fs.readFileSync(filePath, "utf-8");
    const injected = html.replace("</body>", `${devInject}</body>`);
    bodyBuf = Buffer.from(injected, "utf-8");
  }

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": bodyBuf ? bodyBuf.length : size,
    "Cache-Control": CACHE_CONTROL,
    "Accept-Ranges": "bytes",
  });

  if (bodyBuf) {
    res.end(bodyBuf);
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on("error", () => res.end());
}

function createServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }

    const url = new URL(req.url, "http://127.0.0.1");
    let filePath = path.join(__dirname, decodeURIComponent(url.pathname));

    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    try {
      serveFile(res, filePath);
    } catch {
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  });

  return server;
}

// --------------- app lifecycle ---------------

let mainWindow = null;
let server = null;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: "Object Drum Studio",
    icon: path.join(__dirname, "drum-icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);

  if (DEV) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  server = createServer();
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    console.log(`Server: http://127.0.0.1:${port}/`);
    createWindow(port);
  });
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
    server = null;
  }
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && server) {
    createWindow(server.address().port);
  }
});
