/**
 * Manager de jobs para el sistema de logs híbrido.
 * - Exporta logs de BD a archivos JSONL cada 24 horas.
 * - Purga logs de BD mayores a 90 días.
 * - Permite ejecución manual mediante endpoint.
 */

import { exportLogsToFiles, purgeOldLogs } from "./logWriter";

const EXPORT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas
const RETENTION_DAYS = 45;

let lastExportAt: Date | null = null;
let exportInterval: NodeJS.Timeout | null = null;
let isRunning = false;

async function runExportJob(): Promise<{ exported: { actividad: number; errores: number; seguridad: number }; purged: { actividad: number; errores: number; seguridad: number } }> {
  // Exportar desde la última ejecución (o las últimas 24h si es la primera vez)
  const since = lastExportAt ? new Date(lastExportAt.getTime()) : new Date(Date.now() - EXPORT_INTERVAL_MS);
  const exported = await exportLogsToFiles(since);
  const purged = await purgeOldLogs(RETENTION_DAYS);
  lastExportAt = new Date();

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[LOG-JOBS] Exportados: actividad=${exported.actividad}, errores=${exported.errores}, seguridad=${exported.seguridad}`
    );
  }

  return { exported, purged };
}

export class LogJobsManager {
  start(): void {
    if (isRunning) return;

    isRunning = true;

    // Exportar inmediatamente al iniciar el servidor (primera carga)
    runExportJob().catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[LOG-JOBS] Error en exportación inicial:", err);
      }
    });

    exportInterval = setInterval(() => {
      runExportJob().catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[LOG-JOBS] Error en exportación programada:", err);
        }
      });
    }, EXPORT_INTERVAL_MS);

    if (process.env.NODE_ENV === "development") {
      console.log("🚀 Sistema de logs híbrido iniciado (exportación cada 24h, retención 90 días)");
    }
  }

  stop(): void {
    if (exportInterval) {
      clearInterval(exportInterval);
      exportInterval = null;
    }
    isRunning = false;
  }

  async runManualExport(): Promise<{ exported: { actividad: number; errores: number; seguridad: number }; purged: { actividad: number; errores: number; seguridad: number } }> {
    return runExportJob();
  }

  getStatus(): { isRunning: boolean; lastExportAt: string; interval: string } {
    return {
      isRunning,
      lastExportAt: lastExportAt ? lastExportAt.toISOString() : "Nunca",
      interval: "Cada 24 horas",
    };
  }
}

export const logJobsManager = new LogJobsManager();
