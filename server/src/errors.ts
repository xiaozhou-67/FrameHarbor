import { ZodError } from 'zod';
import type { ErrorRequestHandler } from 'express';

export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function assert(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION', message: error.issues[0]?.message ?? '输入格式有误' } });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: '请求内容格式有误' } });
    return;
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'TOO_LARGE', message: '请求内容过大' } });
    return;
  }
  console.error('[FrameHarbor]', error);
  res.status(500).json({ error: { code: 'INTERNAL', message: '服务暂时繁忙，请稍后重试' } });
};
