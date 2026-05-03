import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

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
 *   - `url` is what we hand back to clients; for both backends it is
 *     `/api/uploads/{storedName}` so the existing GET route keeps working
 *     and the bucket can stay private.
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
  put(originalName: string, data: Buffer, mimeType?: string): Promise<StoredFile>;
  /** Read raw bytes back. Throws if the object is missing. */
  read(storedName: string): Promise<Buffer>;
  /** True if the object exists. */
  has(storedName: string): Promise<boolean>;
  /** Best-effort delete; safe to call on missing objects. */
  remove(storedName: string): Promise<void>;
}

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

function newStoredName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().slice(0, 16);
  return `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
}

export class LocalFileStore implements FileStore {
  constructor(private readonly baseDir: string, private readonly publicPrefix: string) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  async put(originalName: string, data: Buffer): Promise<StoredFile> {
    const storedName = newStoredName(originalName);
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

/**
 * S3-backed implementation. Reads stream out via the existing
 * `/api/uploads/:filename` route (the bucket stays private), so URLs
 * stay identical to the local backend and clients don't need to know
 * which backend is active.
 */
export class S3FileStore implements FileStore {
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    region: string,
    private readonly publicPrefix: string,
    private readonly keyPrefix: string = "",
  ) {
    this.client = new S3Client({ region });
  }

  private key(storedName: string): string {
    return `${this.keyPrefix}${storedName}`;
  }

  async put(originalName: string, data: Buffer, mimeType?: string): Promise<StoredFile> {
    const storedName = newStoredName(originalName);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(storedName),
        Body: data,
        ContentType: mimeType,
        ContentLength: data.byteLength,
      }),
    );
    return {
      storedName,
      url: `${this.publicPrefix}${storedName}`,
      sizeBytes: data.byteLength,
    };
  }

  async read(storedName: string): Promise<Buffer> {
    if (!SAFE_NAME.test(storedName)) throw new Error("Invalid stored name");
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(storedName) }),
    );
    const body = out.Body;
    if (!body) throw new Error("Empty S3 object body");
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    // Web ReadableStream / Blob fallback
    const arr = await (body as unknown as { transformToByteArray: () => Promise<Uint8Array> })
      .transformToByteArray();
    return Buffer.from(arr);
  }

  async has(storedName: string): Promise<boolean> {
    if (!SAFE_NAME.test(storedName)) return false;
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(storedName) }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async remove(storedName: string): Promise<void> {
    if (!SAFE_NAME.test(storedName)) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(storedName) }),
      );
    } catch {
      // ignore — best-effort
    }
  }
}

function buildFileStore(): FileStore {
  const driver = (process.env["STORAGE_DRIVER"] ?? "local").toLowerCase();
  const publicPrefix = "/api/uploads/";
  if (driver === "s3") {
    const bucket = process.env["S3_BUCKET"];
    const region = process.env["AWS_REGION"];
    if (!bucket) throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET");
    if (!region) throw new Error("STORAGE_DRIVER=s3 requires AWS_REGION");
    const keyPrefix = process.env["S3_KEY_PREFIX"] ?? "uploads/";
    return new S3FileStore(bucket, region, publicPrefix, keyPrefix);
  }
  return new LocalFileStore(path.resolve(process.cwd(), "uploads"), publicPrefix);
}

/** Process-wide default store; routes should import this rather than instantiate. */
export const fileStore: FileStore = buildFileStore();
