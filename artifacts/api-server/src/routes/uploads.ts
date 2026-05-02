import { Router, type IRouter, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db, attachmentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { audit } from "../lib/audit";

const router: IRouter = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

const MAX_BYTES = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 16);
    const stored = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
    cb(null, stored);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});

router.post(
  "/uploads",
  requireAuth,
  (req: Request, res: Response, next): void => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  async (req, res): Promise<void> => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const buf = await fs.promises.readFile(file.path);
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const kind =
      typeof req.body?.kind === "string" && req.body.kind.length <= 32
        ? req.body.kind
        : "general";
    const url = `/api/uploads/${file.filename}`;
    const [row] = await db
      .insert(attachmentsTable)
      .values({
        uploaderId: req.user!.id,
        kind,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256,
        url,
      })
      .returning();
    await audit(req, "upload.create", "attachment", row!.id, {
      mime: file.mimetype,
      size: file.size,
      kind,
    });
    res.json({
      id: row!.id,
      url: row!.url,
      kind: row!.kind,
      originalName: row!.originalName,
      mimeType: row!.mimeType,
      sizeBytes: row!.sizeBytes,
      sha256: row!.sha256,
      createdAt: row!.createdAt,
    });
  },
);

router.get("/uploads/:filename", async (req, res): Promise<void> => {
  const name = req.params["filename"] ?? "";
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(UPLOAD_DIR, name);
  if (!filePath.startsWith(UPLOAD_DIR)) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }
  const [row] = await db
    .select()
    .from(attachmentsTable)
    .where(eq(attachmentsTable.storedName, name));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File missing" });
    return;
  }
  res.setHeader("Content-Type", row.mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(row.originalName)}"`,
  );
  fs.createReadStream(filePath).pipe(res);
});

router.get("/uploads/meta/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(attachmentsTable).where(eq(attachmentsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: row.id,
    url: row.url,
    kind: row.kind,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    createdAt: row.createdAt,
    uploaderId: row.uploaderId,
  });
});

export default router;
