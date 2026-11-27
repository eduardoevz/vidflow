import http from 'node:http';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getLogger } from '../logging/logger';
import { isHttpUrl } from '../security/paths';

const capturePayloadSchema = z.object({
  url: z.string().refine(isHttpUrl, 'URL inválida'),
  pageUrl: z.string().optional(),
  title: z.string().optional(),
  referer: z.string().optional(),
});

export type CapturedExtensionPayload = z.infer<typeof capturePayloadSchema>;

export interface ExtensionBridgeOptions {
  port: number;
  getToken: () => string;
  getAppVersion: () => string;
  onCapture: (payload: CapturedExtensionPayload) => void;
}

export function generateBridgeToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function tryGetLogger() {
  try {
    return getLogger();
  } catch {
    return undefined;
  }
}

export class ExtensionBridgeServer {
  private server: http.Server | undefined;

  constructor(private readonly options: ExtensionBridgeOptions) {}

  start(): Promise<number> {
    if (this.server) {
      const addr = this.server.address();
      return Promise.resolve(typeof addr === 'object' && addr ? addr.port : this.options.port);
    }

    const logger = tryGetLogger();
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-VidFlow-Token');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const token = req.headers['x-vidflow-token'];
      const expected = this.options.getToken();
      if (!expected || typeof token !== 'string' || !safeTokenEquals(token, expected)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, version: this.options.getAppVersion() }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/capture') {
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf-8');
          if (body.length > 64 * 1024) {
            req.destroy();
          }
        });
        req.on('end', () => {
          try {
            const json = JSON.parse(body) as unknown;
            const parsed = capturePayloadSchema.safeParse(json);
            if (!parsed.success) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'invalid_payload' }));
              return;
            }
            this.options.onCapture(parsed.data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not_found' }));
    });

    this.server = server;
    return new Promise((resolve, reject) => {
      server.once('error', (err) => {
        logger?.warn('extensionBridge', 'Failed to bind local bridge server', { error: err.message });
        reject(err);
      });
      server.listen(this.options.port, '127.0.0.1', () => {
        const addr = server.address();
        const boundPort = typeof addr === 'object' && addr ? addr.port : this.options.port;
        logger?.info('extensionBridge', 'Local bridge listening', { port: boundPort });
        resolve(boundPort);
      });
    });
  }

  stop(): Promise<void> {
    if (!this.server) return Promise.resolve();
    const s = this.server;
    this.server = undefined;
    return new Promise((resolve) => s.close(() => resolve()));
  }
}

function safeTokenEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
