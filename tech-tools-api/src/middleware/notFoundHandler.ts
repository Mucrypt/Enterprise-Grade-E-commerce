import { Request, Response } from 'express'
import logger from '../utils/logger'

export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found:', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  })

  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  })
}
