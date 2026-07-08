/**
 * Rutas del sistema de logs híbrido (Centro de Monitoreo).
 * Lógica separada de routes.ts.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { storage } from "./storage";
import { logJobsManager } from "./logJobs";
import { logger } from "./logger";
import { logsActividad, logsErrores, logsSeguridad, metricasActividadDiaria } from "@shared/schema";
import { desc, gte, and, eq, sql } from "drizzle-orm";
import type { User } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const ROW_LIMIT = 100;

interface AuthenticatedRequest extends Request {
  user?: User;
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token de acceso requerido" });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido" });
    }

    try {
      const user = await storage.getUser(decoded.id);
      if (!user || !user.activo || user.status === "bloqueado") {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const sessionUser = await storage.getUserBySessionToken(token);
      if (!sessionUser || sessionUser.id !== user.id) {
        return res.status(403).json({ message: "Sesión inválida o expirada" });
      }

      const isSessionActive = await storage.isSessionActive(user.id);
      if (!isSessionActive) {
        await storage.clearUserSession(user.id);
        return res.status(403).json({ message: "Sesión expirada" });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
}

function requireAdminOrSupervisor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user?.rol || (req.user.rol !== "admin" && req.user.rol !== "supervisor")) {
    return res.status(403).json({ message: "Requiere rol administrador o supervisor" });
  }
  next();
}

function parseSince(req: Request): Date {
  const q = req.query.since as string | undefined;
  if (q) return new Date(q);
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

export function registerLogsRoutes(app: Router) {
  const router = Router();

  // ─── Actividad ───
  router.get("/logs/actividad", authenticateToken, requireAdminOrSupervisor, async (req, res) => {
    try {
      const since = parseSince(req);
      const rows = await db
        .select()
        .from(logsActividad)
        .where(gte(logsActividad.createdAt, since))
        .orderBy(desc(logsActividad.createdAt))
        .limit(ROW_LIMIT);
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error({ servicio: "Node", endpoint: "GET /api/logs/actividad", mensaje: String(error) });
      res.status(500).json({ success: false, message: "Error al obtener logs de actividad" });
    }
  });

  // ─── Errores ───
  router.get("/logs/errores", authenticateToken, requireAdminOrSupervisor, async (req, res) => {
    try {
      const since = parseSince(req);
      const rows = await db
        .select()
        .from(logsErrores)
        .where(gte(logsErrores.createdAt, since))
        .orderBy(desc(logsErrores.createdAt))
        .limit(ROW_LIMIT);
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error({ servicio: "Node", endpoint: "GET /api/logs/errores", mensaje: String(error) });
      res.status(500).json({ success: false, message: "Error al obtener logs de errores" });
    }
  });

  // ─── Seguridad ───
  router.get("/logs/seguridad", authenticateToken, requireAdminOrSupervisor, async (req, res) => {
    try {
      const since = parseSince(req);
      const rows = await db
        .select()
        .from(logsSeguridad)
        .where(gte(logsSeguridad.createdAt, since))
        .orderBy(desc(logsSeguridad.createdAt))
        .limit(ROW_LIMIT);
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error({ servicio: "Node", endpoint: "GET /api/logs/seguridad", mensaje: String(error) });
      res.status(500).json({ success: false, message: "Error al obtener logs de seguridad" });
    }
  });

  // ─── Métricas para gráficos ───
  router.get("/metricas", authenticateToken, requireAdminOrSupervisor, async (req, res) => {
    try {
      const since = parseSince(req);
      const rows = await db
        .select()
        .from(metricasActividadDiaria)
        .where(gte(metricasActividadDiaria.fecha, since))
        .orderBy(metricasActividadDiaria.fecha, metricasActividadDiaria.hora);
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error({ servicio: "Node", endpoint: "GET /api/metricas", mensaje: String(error) });
      res.status(500).json({ success: false, message: "Error al obtener métricas" });
    }
  });

  // ─── Exportación manual (solo admin) ───
  router.post(
    "/admin/logs/export",
    authenticateToken,
    requireAdminOrSupervisor,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = await logJobsManager.runManualExport();
        logger.actividad({
          usuarioId: req.user?.id,
          username: req.user?.username,
          accion: "logs_export_manual",
          modulo: "Monitoreo",
          resultado: "exitoso",
          ip: req.clientIp,
        });
        res.json({ success: true, ...result });
      } catch (error) {
        logger.error({
          servicio: "Node",
          endpoint: "POST /api/admin/logs/export",
          mensaje: String(error),
        });
        res.status(500).json({ success: false, message: "Error al exportar logs" });
      }
    }
  );

  // ─── Estado del job ───
  router.get("/admin/logs/status", authenticateToken, requireAdminOrSupervisor, (req, res) => {
    res.json({ success: true, status: logJobsManager.getStatus() });
  });

  app.use("/api", router);
}
