/**
 * Sistema de logs híbrido (BD + archivos JSON)
 * Registra actividad, errores y seguridad en PostgreSQL (para la UI)
 * y delega la escritura a archivos JSONL al LogWriter (24h o manual).
 */

import os from "os";
import { db } from "../db";
import {
  logsActividad,
  logsErrores,
  logsSeguridad,
  metricasActividadDiaria,
  logTipoMetricaEnum,
  type InsertLogsActividad,
  type InsertLogsErrores,
  type InsertLogsSeguridad,
} from "@shared/schema";
import { sql } from "drizzle-orm";

const HOSTNAME = os.hostname();
const APP_NAME = "sirad-cdr";
const FACILITY = "local0";

// Mapa RFC 5424 severidad numérica -> label
const severityMap: Record<number, string> = {
  0: "emergency",
  1: "alert",
  2: "critical",
  3: "error",
  4: "warning",
  5: "notice",
  6: "info",
  7: "debug",
};

// Resultado/nivel -> severity numérica
function resultadoToSeverity(resultado: "exitoso" | "error" | "advertencia"): number {
  switch (resultado) {
    case "error": return 3;
    case "advertencia": return 4;
    case "exitoso":
    default: return 6;
  }
}

function nivelToSeverity(nivel: "bajo" | "medio" | "alto"): number {
  switch (nivel) {
    case "alto": return 1; // alert
    case "medio": return 4; // warning
    case "bajo":
    default: return 5; // notice
  }
}

function serviceToSeverity(servicio: string, nivel: string): number {
  switch (nivel) {
    case "critical": return 2;
    case "error": return 3;
    case "warn": return 4;
    case "info": return 6;
    case "debug": return 7;
    default: return 3;
  }
}

function getProcid(): string | undefined {
  return process.pid?.toString();
}

function nowRfc5424(): string {
  return new Date().toISOString();
}

// ─── ACTIVIDAD ───────────────────────────────────────────────────────────────

export interface ActividadInput {
  usuarioId?: number;
  username?: string;
  accion: string;
  modulo: string;
  resultado: "exitoso" | "error" | "advertencia";
  ip?: string;
  msgid?: string;
  metadata?: Record<string, unknown>;
}

export function registrarActividad(input: ActividadInput): void {
  const severity = resultadoToSeverity(input.resultado);
  const row: InsertLogsActividad = {
    severity,
    severityLabel: severityMap[severity] as any,
    facility: FACILITY,
    hostname: HOSTNAME,
    appName: APP_NAME,
    procid: getProcid(),
    msgid: input.msgid || input.accion,
    timestampRfc5424: new Date(nowRfc5424()),
    usuarioId: input.usuarioId,
    username: input.username,
    accion: input.accion,
    modulo: input.modulo,
    resultado: input.resultado,
    ip: input.ip,
    metadata: input.metadata ?? null,
  };

  // Insert asíncrono fire-and-forget: no bloquea la respuesta al usuario
  (async () => {
    try {
      await db.insert(logsActividad).values(row);
      await incrementarMetrica(input.accion);
    } catch (err) {
      // Si falla el log en BD, solo lo registramos en consola (sin cascada)
      if (process.env.NODE_ENV === "development") {
        console.error("[LOGGER] Error registrando actividad:", err);
      }
    }
  })();
}

// ─── ERRORES ──────────────────────────────────────────────────────────────────

export interface ErrorInput {
  servicio: "Node" | "Python" | "PostgreSQL" | string;
  endpoint?: string;
  mensaje: string;
  detalle?: string;
  nivel?: "critical" | "error" | "warn" | "info" | "debug";
  msgid?: string;
}

export function registrarError(input: ErrorInput): void {
  const severity = serviceToSeverity(input.servicio, input.nivel || "error");
  const row: InsertLogsErrores = {
    severity,
    severityLabel: severityMap[severity] as any,
    facility: FACILITY,
    hostname: HOSTNAME,
    appName: APP_NAME,
    procid: getProcid(),
    msgid: input.msgid || "ERROR",
    timestampRfc5424: new Date(nowRfc5424()),
    servicio: input.servicio,
    endpoint: input.endpoint,
    mensaje: input.mensaje,
    detalle: input.detalle ?? null,
    revisado: false,
  };

  (async () => {
    try {
      await db.insert(logsErrores).values(row);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[LOGGER] Error registrando error:", err);
      }
    }
  })();
}

// ─── SEGURIDAD ───────────────────────────────────────────────────────────────

export interface SeguridadInput {
  tipo: string;
  usuarioId?: number;
  username?: string;
  ip?: string;
  detalle?: string;
  nivel: "bajo" | "medio" | "alto";
  msgid?: string;
}

export function registrarSeguridad(input: SeguridadInput): void {
  const severity = nivelToSeverity(input.nivel);
  const row: InsertLogsSeguridad = {
    severity,
    severityLabel: severityMap[severity] as any,
    facility: "authpriv",
    hostname: HOSTNAME,
    appName: APP_NAME,
    procid: getProcid(),
    msgid: input.msgid || input.tipo,
    timestampRfc5424: new Date(nowRfc5424()),
    tipo: input.tipo,
    usuarioId: input.usuarioId,
    username: input.username,
    ip: input.ip,
    detalle: input.detalle ?? null,
    nivel: input.nivel,
  };

  (async () => {
    try {
      await db.insert(logsSeguridad).values(row);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[LOGGER] Error registrando seguridad:", err);
      }
    }
  })();
}

// ─── ROLLUP DE MÉTRICAS (para gráficos) ─────────────────────────────────────

async function incrementarMetrica(accion: string): Promise<void> {
  const tipo: "actividad" | "trazabilidad" = accion.startsWith("trazabilidad")
    ? "trazabilidad"
    : "actividad";

  const now = new Date();
  const fechaHora = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0,
    0,
    0
  );

  try {
    await db
      .insert(metricasActividadDiaria)
      .values({
        fecha: fechaHora,
        hora: now.getHours(),
        tipo,
        conteo: 1,
      })
      .onConflictDoUpdate({
        target: [
          metricasActividadDiaria.fecha,
          metricasActividadDiaria.hora,
          metricasActividadDiaria.tipo,
        ],
        set: {
          conteo: sql`${metricasActividadDiaria.conteo} + 1`,
        },
      });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[LOGGER] Error actualizando métrica:", err);
    }
  }
}

export const logger = {
  actividad: registrarActividad,
  error: registrarError,
  seguridad: registrarSeguridad,
};
