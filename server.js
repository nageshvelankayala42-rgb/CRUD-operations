const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "students.db");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8"
};

function openDb() {
  return new DatabaseSync(DB_PATH, { open: true, readOnly: false });
}

function initDb() {
  const db = openDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        roll_no TEXT NOT NULL,
        class_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const count = db.prepare("SELECT COUNT(*) AS total FROM students").get().total;
    if (count === 0) {
      const insert = db.prepare(`
        INSERT INTO students (name, roll_no, class_name, email, phone, address)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insert.run("Ananya Sharma", "101", "10 A", "ananya@example.com", "9876543210", "Hyderabad");
      insert.run("Rahul Kumar", "102", "10 B", "rahul@example.com", "9123456780", "Bengaluru");
    }
  } finally {
    db.close();
  }
}

function toStudent(row) {
  return {
    id: row.id,
    name: row.name,
    rollNo: row.roll_no,
    className: row.class_name
  };
}

function normalizeStudent(body) {
  const rollNo = String(body.rollNo || "").trim();
  const student = {
    name: String(body.name || "").trim(),
    rollNo,
    className: String(body.className || "").trim(),
    email: String(body.email || `student-${rollNo || Date.now()}@example.com`).trim(),
    phone: String(body.phone || "Not provided").trim(),
    address: String(body.address || "Not provided").trim()
  };

  if (!student.name || !student.rollNo || !student.className) {
    return null;
  }

  return student;
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
  });
}

function listStudents() {
  const db = openDb();
  try {
    return db
      .prepare(
        `SELECT id, name, roll_no, class_name, email, phone, address
         FROM students
         ORDER BY id DESC`
      )
      .all()
      .map(toStudent);
  } finally {
    db.close();
  }
}

function createStudent(student) {
  const db = openDb();
  try {
    const result = db
      .prepare(
        `INSERT INTO students (name, roll_no, class_name, email, phone, address)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(student.name, student.rollNo, student.className, student.email, student.phone, student.address);

    return getStudent(Number(result.lastInsertRowid));
  } finally {
    db.close();
  }
}

function getStudent(id) {
  const db = openDb();
  try {
    const row = db
      .prepare("SELECT id, name, roll_no, class_name, email, phone, address FROM students WHERE id = ?")
      .get(id);
    return row ? toStudent(row) : null;
  } finally {
    db.close();
  }
}

function updateStudent(id, student) {
  const db = openDb();
  try {
    const result = db
      .prepare(
        `UPDATE students
         SET name = ?, roll_no = ?, class_name = ?, email = ?, phone = ?, address = ?
         WHERE id = ?`
      )
      .run(
        student.name,
        student.rollNo,
        student.className,
        student.email,
        student.phone,
        student.address,
        id
      );

    return result.changes ? getStudent(id) : null;
  } finally {
    db.close();
  }
}

function deleteStudent(id) {
  const db = openDb();
  try {
    const result = db.prepare("DELETE FROM students WHERE id = ?").run(id);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/students") {
    return sendJson(res, 200, { students: listStudents() });
  }

  if (req.method === "POST" && url.pathname === "/api/students") {
    try {
      const student = normalizeStudent(await parseJsonBody(req));
      if (!student) {
        return sendJson(res, 400, { error: "Student name, class, and roll number are required." });
      }

      return sendJson(res, 201, { student: createStudent(student) });
    } catch (error) {
      if (String(error.message || "").includes("UNIQUE constraint failed")) {
        return sendJson(res, 409, { error: "Student email already exists." });
      }
      return sendJson(res, 400, { error: error.message || "Bad request" });
    }
  }

  const studentRoute = url.pathname.match(/^\/api\/students\/(\d+)$/);
  if (studentRoute && req.method === "PUT") {
    try {
      const student = normalizeStudent(await parseJsonBody(req));
      if (!student) {
        return sendJson(res, 400, { error: "Student name, class, and roll number are required." });
      }

      const updated = updateStudent(Number(studentRoute[1]), student);
      if (!updated) {
        return sendJson(res, 404, { error: "Student not found." });
      }

      return sendJson(res, 200, { student: updated });
    } catch (error) {
      if (String(error.message || "").includes("UNIQUE constraint failed")) {
        return sendJson(res, 409, { error: "Student email already exists." });
      }
      return sendJson(res, 400, { error: error.message || "Bad request" });
    }
  }

  if (studentRoute && req.method === "DELETE") {
    if (!deleteStudent(Number(studentRoute[1]))) {
      return sendJson(res, 404, { error: "Student not found." });
    }

    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "API route not found." });
}

function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(ROOT, `.${requestedPath}`);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(content);
  });
}

initDb();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }

  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Student CRUD app running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
