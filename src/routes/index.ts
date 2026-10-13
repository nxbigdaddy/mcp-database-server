import { Router } from 'express';
import {
  connectionsController,
  queryController,
  metadataController,
  dataController,
  auditController,
  settingsController,
  systemController,
} from '@/controllers';

const router = Router();

// System routes
router.get('/health', systemController.health.bind(systemController));
router.get('/version', systemController.version.bind(systemController));

// Connections routes
router.get('/connections', connectionsController.list.bind(connectionsController));
router.get('/connections/:id', connectionsController.get.bind(connectionsController));
router.post('/connections', connectionsController.create.bind(connectionsController));
router.put('/connections/:id', connectionsController.update.bind(connectionsController));
router.delete('/connections/:id', connectionsController.delete.bind(connectionsController));
router.post('/connections/:id/test', connectionsController.test.bind(connectionsController));
router.post('/connections/:id/ping', connectionsController.ping.bind(connectionsController));
router.post('/connections/:id/pool/reset', connectionsController.resetPool.bind(connectionsController));

// Query routes
router.post('/query', queryController.execute.bind(queryController));
router.post('/query/transaction', queryController.executeUpdate.bind(queryController));
router.post('/query/batch', queryController.executeBatch.bind(queryController));
router.post('/query/explain', queryController.explain.bind(queryController));
router.post('/query/transaction/begin', queryController.beginTransaction.bind(queryController));
router.post('/query/transaction/commit', queryController.commitTransaction.bind(queryController));
router.post('/query/transaction/rollback', queryController.rollbackTransaction.bind(queryController));

// Metadata routes
router.get('/:connectionId/databases', metadataController.getDatabases.bind(metadataController));
router.get('/:connectionId/tables', metadataController.getTables.bind(metadataController));
router.get('/:connectionId/views', metadataController.getViews.bind(metadataController));
router.get('/:connectionId/schema/:table', metadataController.getSchema.bind(metadataController));
router.get('/:connectionId/indexes/:table', metadataController.getIndexes.bind(metadataController));
router.get('/:connectionId/fkeys/:table', metadataController.getForeignKeys.bind(metadataController));
router.get('/:connectionId/procedures', metadataController.getProcedures.bind(metadataController));
router.get('/:connectionId/functions', metadataController.getFunctions.bind(metadataController));

// Data routes
router.get('/:connectionId/data/:table', dataController.getTableData.bind(dataController));
router.post('/:connectionId/data/:table', dataController.insertData.bind(dataController));
router.put('/:connectionId/data/:table/:id', dataController.updateData.bind(dataController));
router.delete('/:connectionId/data/:table/:id', dataController.deleteData.bind(dataController));

// Audit routes
router.get('/audit/logs', auditController.getLogs.bind(auditController));
router.get('/audit/logs/:id', auditController.getLog.bind(auditController));
router.get('/audit/stats', auditController.getStats.bind(auditController));
router.get('/audit/export', auditController.exportLogs.bind(auditController));
router.delete('/audit/logs', auditController.clearLogs.bind(auditController));

// Settings routes
router.get('/settings', settingsController.getSettings.bind(settingsController));
router.put('/settings', settingsController.updateSettings.bind(settingsController));
router.get('/settings/:key', settingsController.getSetting.bind(settingsController));
router.put('/settings/:key', settingsController.updateSetting.bind(settingsController));

export default router;
