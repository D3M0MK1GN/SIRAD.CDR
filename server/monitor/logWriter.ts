/**
 * Escritor de logs a archivos JSONL (RFC 5424)
 * Cada 24h o bajo demanda exporta los logs de BD a archivos de texto
 * en la carpeta `logs/` para auditoría manual o ingestión externa.
 */

import fs from "fs/promises";
import path from "path";
import { db } from "../db";
import { logsActividad, logsErrores, logsSeguridad } from "@shared/schema";
import { desc, gte, lte } from "drizzle-orm";

const LOGS_DIR = path.join(process.cwd(), "logs");

export interface Rfc5424Json {
  priority: number;
  version: number;
  timestamp: string;
  hostname: string;
  app_name: string;
  procid?: string;
  msgid?: string;
  structured_data: Record<string, Record<string, string | number | boolean | null | undefined>>;
  message: string;
}

function toRfc5424Json(
  row: any,
  message: string,
  sdId: string,
  sdFields: Record<string, string | number | boolean | null | undefined>
): Rfc5424Json {
  return {
    priority: row.severity,
    version: 1,
    timestamp: row.timestampRfc5424.toISOString(),
    hostname: row.hostname,
    app_name: row.appName,
    procid: row.procid || undefined,
    msgid: row.msgid || undefined,
    structured_data: {
      [sdId]: sdFields,
    },
    message,
  };
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function filePath(prefix: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return path.join(LOGS_DIR, `${prefix}-${yyyy}-${mm}-${dd}.jsonl`);
}

async function appendLines(file: string, lines: string[]): Promise<void> {
  if (lines.length === 0) return;
  await fs.appendFile(file, lines.join("\n") + "\n", "utf-8");
}

export async function exportLogsToFiles(since: Date): Promise<{
  actividad: number;
  errores: number;
  seguridad: number;
}> {
  await ensureDir();
  const now = new Date();

  // ─── Actividad ───
  const actividadRows = await db
    .select()
    .from(logsActividad)
    .where(gte(logsActividad.createdAt, since))
    .orderBy(desc(logsActividad.createdAt));

  const actividadLines = actividadRows.map((r) =>
    JSON.stringify(
      toRfc5424Json(
        r,
        `${r.accion} | ${r.username || "anonymous"} | ${r.resultado}`,
        `audit@32473`,
        {
          usuario_id: r.usuarioId,
          username: r.username,
          accion: r.accion,
          modulo: r.modulo,
          resultado: r.resultado,
          ip: r.ip,
        }
      )
    )
  );
  await appendLines(filePath("audit", now), actividadLines);

  // ─── Errores ───
  const erroresRows = await db
    .select()
    .from(logsErrores)
    .where(gte(logsErrores.createdAt, since))
    .orderBy(desc(logsErrores.createdAt));

  const erroresLines = erroresRows.map((r) =>
    JSON.stringify(
      toRfc5424Json(
        r,
        `${r.servicio} | ${r.endpoint || "N/A"} | ${r.mensaje}`,
        `error@32473`,
        {
          servicio: r.servicio,
          endpoint: r.endpoint,
          revisado: r.revisado,
        }
      )
    )
  );
  await appendLines(filePath("errors", now), erroresLines);

  // ─── Seguridad ───
  const seguridadRows = await db
    .select()
    .from(logsSeguridad)
    .where(gte(logsSeguridad.createdAt, since))
    .orderBy(desc(logsSeguridad.createdAt));

  const seguridadLines = seguridadRows.map((r) =>
    JSON.stringify(
      toRfc5424Json(
        r,
        `${r.tipo} | ${r.username || "anonymous"} | ${r.nivel}`,
        `security@32473`,
        {
          usuario_id: r.usuarioId,
          username: r.username,
          tipo: r.tipo,
          ip: r.ip,
          nivel: r.nivel,
        }
      )
    )
  );
  await appendLines(filePath("security", now), seguridadLines);

  return {
    actividad: actividadLines.length,
    errores: erroresLines.length,
    seguridad: seguridadLines.length,
  };
}

export async function purgeOldLogs(days: number): Promise<{
  actividad: number;
  errores: number;
  seguridad: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // IMPORTANTE: borrar registros ANTIGUOS (createdAt <= cutoff), no recientes.
  const actividad = await db
    .delete(logsActividad)
    .where(lte(logsActividad.createdAt, cutoff));

  const errores = await db
    .delete(logsErrores)
    .where(lte(logsErrores.createdAt, cutoff));

  const seguridad = await db
    .delete(logsSeguridad)
    .where(lte(logsSeguridad.createdAt, cutoff));

  return {
    actividad: actividad.rowCount || 0,
    errores: errores.rowCount || 0,
    seguridad: seguridad.rowCount || 0,
  };
}
