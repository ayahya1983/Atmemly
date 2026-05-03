import { Router, type IRouter, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db, attachmentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { audit } from "../lib/audit";
import { fileStore } from "../lib/storage";

const router: IRouter = Router();

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

// Memory storage so the same Buffer can be handed to either the local-disk
// or S3 backend without writing a temp file we'd then have to re-read.
const upload = multer({
  storage: multer.memoryStorage(),
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
    if (!file || !file.buffer) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const kind =
      typeof req.body?.kind === "string" && req.body.kind.length <= 32
        ? req.body.kind
        : "general";
    const stored = await fileStore.put(file.originalname, file.buffer, file.mimetype);
    const [row] = await db
      .insert(attachmentsTable)
      .values({
        uploaderId: req.user!.id,
        kind,
        originalName: file.originalname,
        storedName: stored.storedName,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        sha256,
        url: stored.url,
      })
      .returning();
    await audit(req, "upload.create", "attachment", row!.id, {
      mime: file.mimetype,
      size: stored.sizeBytes,
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
  const [row] = await db
    .select()
    .from(attachmentsTable)
    .where(eq(attachmentsTable.storedName, name));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await fileStore.has(name))) {
    res.status(404).json({ error: "File missing" });
    return;
  }
  let buf: Buffer;
  try {
    buf = await fileStore.read(name);
  } catch {
    res.status(404).json({ error: "File missing" });
    return;
  }
  res.setHeader("Content-Type", row.mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(row.originalName)}"`,
  );
  res.setHeader("Content-Length", String(buf.byteLength));
  res.end(buf);
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
