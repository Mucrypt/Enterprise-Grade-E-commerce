/**
 * ANOMALY DETECTION WORKER
 * Periodically runs anomaly detection checks
 * Detects operational issues and creates alerts
 */

import { AnomalyDetector } from '../services/anomaly.detector';
import logger from '../utils/logger';

let anomalyCheckInterval: NodeJS.Timeout | null = null;
let anomalyDetector: AnomalyDetector | null = null;

/**
 * Start the anomaly detection worker
 * Runs checks every 15 minutes
 */
export function startAnomalyDetectionWorker(): void {
  try {
    anomalyDetector = new AnomalyDetector();

    // Run check immediately
    anomalyDetector.detectAnomalies().catch(err => 
      logger.error('Error in anomaly detection check:', err)
    );

    // Then run periodically every 15 minutes
    anomalyCheckInterval = setInterval(async () => {
      try {
        if (anomalyDetector) {
          await anomalyDetector.detectAnomalies();
        }
      } catch (error) {
        logger.error('Error in anomaly detection interval:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    logger.info('✅ Anomaly detection worker started (runs every 15 minutes)');
  } catch (error) {
    logger.error('Failed to start anomaly detection worker:', error);
  }
}

/**
 * Stop the anomaly detection worker
 */
export function stopAnomalyDetectionWorker(): void {
  if (anomalyCheckInterval) {
    clearInterval(anomalyCheckInterval);
    anomalyCheckInterval = null;
    logger.info('Anomaly detection worker stopped');
  }
}

/**
 * Trigger immediate anomaly detection check
 * Useful for manual triggers or testing
 */
export async function triggerAnomalyCheck(): Promise<void> {
  if (anomalyDetector) {
    await anomalyDetector.detectAnomalies();
  }
}
