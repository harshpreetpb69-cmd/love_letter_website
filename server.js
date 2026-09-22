const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const NOTES_FILE = path.join(DATA_DIR, "notes.json");
const MAX_NOTES = 80;
const MAX_MESSAGE = 400;
const MAX_NAME = 40;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || "Love Letter <onboarding@resend.dev>";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function ensureNotesFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, "[]", "utf8");
}

function readNotes() {
  ensureNotesFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(NOTES_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotes(notes) {
  ensureNotesFile();
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), "utf8");
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain" });
      res.end(err.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 8192) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function sendReplyNotification(from, message) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [NOTIFY_EMAIL],
      subject: `New love note from ${from}`,
      text: `From: ${from}\n\n${message}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}`);
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      song: "Do Pal — ABRK",
    });
  }

  if (req.method === "GET" && pathname === "/api/notes") {
    return sendJson(res, 200, { notes: readNotes().slice(-MAX_NOTES).reverse() });
  }

  if (req.method === "POST" && pathname === "/api/notes") {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const from = cleanText(body.from, MAX_NAME) || "Wifey";
      const message = cleanText(body.message, MAX_MESSAGE);
      if (message.length < 2) {
            return sendJson(res, 400, { error: "A message is required." });
      }
      const notes = readNotes();
      notes.push({
        id: Date.now().toString(36),
        from,
        message,
        createdAt: new Date().toISOString(),
      });
      writeNotes(notes.slice(-MAX_NOTES));
      let emailSent = false;
      try {
        emailSent = await sendReplyNotification(from, message);
      } catch (error) {
        console.error("Reply notification failed:", error.message);
      }
      return sendJson(res, 201, { ok: true, emailSent });
    } catch {
      return sendJson(res, 400, { error: "Invalid request." });
    }
  }

  if (pathname.startsWith("/api/")) {
    return sendJson(res, 404, { error: "Not found" });
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath);
  if (safePath === path.sep || safePath === "/" || safePath === ".") {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    if (err || (stat && stat.isDirectory())) {
      return sendFile(res, path.join(PUBLIC_DIR, "index.html"));
    }
    sendFile(res, filePath);
  });
});

server.listen(PORT, HOST, () => {
  ensureNotesFile();
  console.log(`Love letter server ready at http://localhost:${PORT}`);
});
