import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

/**
 * Architecture audit (May 2026) — abstraction boundary for file storage.
 *
 * Today every artifact is uploaded to the local `uploads/` directory and
 * served back through `/api/uploads/:filename`. That works for a single
 * Replit instance but does not survive horizontal scaling or container
 * restarts on platforms with ephemeral disks. Wrapping the read/write in a
 * thin interface lets us swap to Replit Object Storage / S3 / GCS later
 * without touching every route.
 *
 * Convention:
 *   - `storedName` is opaque (random prefix + sanitized extension).
 *   - `url` is what we hand back to clients; for the local backend it is
 *     `/api/uploads/{storedName}` so the existing GET route keeps working.
 *   - Buffers are passed in/out to keep the interface backend-agnostic
 *     (cloud SDKs typically want either a Buffer or a stream).
 */
export interface StoredFile {
  storedName: string;
  url: string;
  sizeBytes: number;
}

export interface FileStore {
  /**
   * Persist `data` keyed by a freshly-allocated stored name. The `originalName`
   * is used only to derive the file extension; clients should never see it.
   */
  put(originalName: string, data: Buffer): Promise<StoredFile>;
  /** Stream raw bytes back. Throws if the object is missing. */
  read(storedName: string): Promise<Buffer>;
  /** True if the object exists. */
  has(storedName: string): Promise<boolean>;
  /** Best-effort delete; safe to call on missing objects. */
  remove(storedName: string): Promise<void>;
}

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export class LocalFileStore implements FileStore {
  constructor(private readonly baseDir: string, private readonly publicPrefix: string) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  async put(originalName: string, data: Buffer): Promise<StoredFile> {
    const ext = path.extname(originalName).toLowerCase().slice(0, 16);
    const storedName = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
    const target = path.join(this.baseDir, storedName);
    await fs.promises.writeFile(target, data);
    return {
      storedName,
      url: `${this.publicPrefix}${storedName}`,
      sizeBytes: data.byteLength,
    };
  }

  async read(storedName: string): Promise<Buffer> {
    if (!SAFE_NAME.test(storedName)) throw new Error("Invalid stored name");
    const target = path.join(this.baseDir, storedName);
    if (!target.startsWith(this.baseDir)) throw new Error("Path escape detected");
    return fs.promises.readFile(target);
  }

  async has(storedName: string): Promise<boolean> {
    if (!SAFE_NAME.test(storedName)) return false;
    const target = path.join(this.baseDir, storedName);
    if (!target.startsWith(this.baseDir)) return false;
    try {
      await fs.promises.access(target, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async remove(storedName: string): Promise<void> {
    if (!SAFE_NAME.test(storedName)) return;
    const target = path.join(this.baseDir, storedName);
    if (!target.startsWith(this.baseDir)) return;
    try {
      await fs.promises.unlink(target);
    } catch {
      // ignore — best-effort
    }
  }
}

/** Process-wide default store; routes should import this rather than instantiate. */
export const fileStore: FileStore = new LocalFileStore(
  path.resolve(process.cwd(), "uploads"),
  "/api/uploads/",
);
