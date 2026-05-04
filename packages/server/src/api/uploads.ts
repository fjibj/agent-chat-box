import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(PROJECT_ROOT, 'data', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** Ensure upload directory exists */
function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Register upload API routes */
export async function registerUploadRoutes(app: FastifyInstance): Promise<void> {
  ensureUploadDir();

  // POST /api/uploads — upload file
  app.post('/api/uploads', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await (request as { file: () => Promise<any> }).file(); // eslint-disable-line @typescript-eslint/no-explicit-any -- fastify-multipart typing
    if (!data) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    // Check file size
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of data.file) {
      totalSize += chunk.length;
      if (totalSize > MAX_FILE_SIZE) {
        return reply.status(413).send({ error: 'File too large (max 10MB)' });
      }
      chunks.push(chunk);
    }

    const fileBuffer = Buffer.concat(chunks);
    const id = 'up_' + crypto.randomUUID();
    const ext = path.extname(data.filename);
    const filename = id + ext;
    const filePath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filePath, fileBuffer);

    return reply.status(201).send({
      id,
      url: `/api/uploads/${id}`,
      name: data.filename,
      mime: data.mimetype,
      size: totalSize,
    });
  });

  // GET /api/uploads/:id — download file
  app.get('/api/uploads/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    // Find file (could have any extension)
    const files = fs.readdirSync(UPLOAD_DIR);
    const file = files.find(f => f.startsWith(id));

    if (!file) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const filePath = path.join(UPLOAD_DIR, file);
    const stat = fs.statSync(filePath);

    // Determine MIME type from extension
    const ext = path.extname(file).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.py': 'text/x-python',
    };

    const mime = mimeTypes[ext] || 'application/octet-stream';

    return reply
      .type(mime)
      .header('Content-Length', stat.size)
      .send(fs.createReadStream(filePath));
  });
}
