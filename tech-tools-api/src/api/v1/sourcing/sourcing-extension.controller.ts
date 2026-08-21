import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import logger from '../../../utils/logger'
import { extensionDirectoryExists, streamExtensionZip } from '../../../services/sourcing/sourcing-extension-package.service'

export const downloadSourcingExtension = (req: AuthRequest, res: Response): void => {
  if (!extensionDirectoryExists()) {
    logger.error('Sourcing extension download requested but the extension directory was not found on disk (check SOURCING_EXTENSION_DIR)')
    res.status(500).json({ success: false, error: 'The extension package is not available on this server right now. Contact support.' })
    return
  }
  streamExtensionZip(res)
}
