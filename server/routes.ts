// Seccion de Rutas
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users, personasCasos, personaTelefonos, experticias, expedientesSujetos } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  insertUserSchema,
  insertSolicitudSchema,
  insertPlantillaCorreoSchema,
  insertPlantillaWordSchema,
  insertExperticiasSchema,
  insertPersonaCasoSchema,
  insertExpedienteSujetoSchema,
  insertPersonaTelefonoSchema,
  insertRegistroComunicacionSchema,
  loginSchema,
  type User,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import multer from "multer";
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { processTextMessage, processFileMessage, getMimeType, isSupportedFileType } from "./model_ai/gemini";
import { registerDocumentRoutes, generateWordDocument, generateExcelDocument } from "./routes_gest";
import { generateUserGuideHTML } from "../tools/user_gui";
import { registerChatbotRoutes } from "./model_ai/routesAI";
import { registerStatsRoutes } from "./routes-stats";
import { registerAnalisisRoutes } from "./routesAnalisi";
import { parseWithPrefixes } from '../tools/utils_I';
import { logger } from "./logger";

// import { readFileSync, existsSync } from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ExcelJS from 'exceljs';


 // Al inicio del archivo routes.ts
const swiPdf = {
  downloadAsPdf: false,
  // otros valores de configuración...
};


const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only Word documents
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/msword') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Word (.doc, .docx)') as any, false);
    }
  }
});

// Configure multer for data import files (Excel, CSV, TXT)
const uploadData = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow Excel, CSV, TXT files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'text/plain', // .txt
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls), CSV (.csv) o TXT (.txt)') as any, false);
    }
  }
});



// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}



interface AuthenticatedRequest extends Request {
  user?: User;
}

// Middleware para verificar JWT
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) {
      // JWT verification failed - token invalid or expired
      return res.status(403).json({ message: 'Token inválido' });
    }

    try {
      const user = await storage.getUser(decoded.id);
      if (!user) {
        return res.status(403).json({ message: 'Usuario no encontrado' });
      }

      // Check if user is active and not blocked
      if (!user.activo || user.status === 'bloqueado') {
        return res.status(403).json({ message: 'Acceso denegado' });
      }

      // Check if session is still active
      const sessionUser = await storage.getUserBySessionToken(token);
      if (!sessionUser || sessionUser.id !== user.id) {
        return res.status(403).json({ message: 'Sesión inválida o expirada' });
      }

      // Check if session has expired
      const isSessionActive = await storage.isSessionActive(user.id);
      if (!isSessionActive) {
        // Clear expired session
        await storage.clearUserSession(user.id);
        return res.status(403).json({ message: 'Sesión expirada' });
      }

      req.user = user;
      next();
    } catch (error) {
      // Authentication middleware error - handle gracefully
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Background task to check for expired suspensions every 5 minutes
  const suspensionCheckInterval = setInterval(async () => {
    try {
      const suspendedUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.status, 'suspendido'));

      const promises = suspendedUsers.map(user => storage.checkSuspensionExpired(user.id));
      await Promise.allSettled(promises);
    } catch (error) {
      // Error checking expired suspensions - background task continues
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Background task to clean up old notifications every hour
  const notificationCleanupInterval = setInterval(async () => {
    try {
      await storage.cleanupOldNotifications();
    } catch (error) {
      // Error cleaning up old notifications - background task continues
    }
  }, 60 * 60 * 1000); // 1 hour

  // Cleanup intervals on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(suspensionCheckInterval);
    clearInterval(notificationCleanupInterval);
  });

  process.on('SIGINT', () => {
    clearInterval(suspensionCheckInterval);
    clearInterval(notificationCleanupInterval);
  });

  // Crear usuario admin por defecto si no existe
  const adminUser = await storage.getUserByUsername("admin");
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await storage.createUser({
      username: "admin",
      password: hashedPassword,
      nombre: "Administrador",
      email: "admin@sistema.com",
      rol: "admin",
    });
  }

  // Auth Routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const clientIp = (req as any).clientIp || 'unknown';
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        // Increment failed attempts for non-existent users too (security)
        logger.actividad({
          username,
          accion: "login_fail",
          modulo: "Autenticación",
          resultado: "error",
          ip: clientIp,
          metadata: { motivo: "usuario_no_existe" },
        });
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Check if user suspension has expired
      await storage.checkSuspensionExpired(user.id);
      
      // Refetch user to get updated status
      const updatedUser = await storage.getUserByUsername(username);
      if (!updatedUser) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Check if user is suspended or blocked
      if (updatedUser.status === 'suspendido') {
        if (updatedUser.tiempoSuspension) {
          const now = new Date();
          const suspensionEnd = new Date(updatedUser.tiempoSuspension);
          if (now < suspensionEnd) {
            const timeLeftMs = suspensionEnd.getTime() - now.getTime();
            const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
            const minutes = Math.ceil((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
            
            let timeMessage = "";
            if (hours > 0) {
              timeMessage = `${hours} hora${hours !== 1 ? 's' : ''}`;
              if (minutes > 0) {
                timeMessage += ` y ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
              }
            } else {
              timeMessage = `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
            }
            
            return res.status(401).json({ 
              message: `Cuenta Suspendida (${timeMessage})`
            });
          }
        } else {
          return res.status(401).json({ message: "Cuenta Suspendida" });
        }
      }

      if (updatedUser.status === 'bloqueado') {
        return res.status(401).json({ message: "Cuenta Bloqueada" });
      }

      if (!updatedUser.activo) {
        return res.status(401).json({ message: "Usuario inactivo" });
      }

      const isValidPassword = await bcrypt.compare(password, updatedUser.password);
      if (!isValidPassword) {
        // Increment failed attempts
        await storage.incrementFailedAttempts(username);
        
        // Check if user should be suspended
        const wasSuspended = await storage.checkAndSuspendUser(username);
        if (wasSuspended) {
          // Notify admins about the suspension
          await storage.notifyAdminsOfFailedLoginSuspension(username, clientIp);
          logger.seguridad({
            usuarioId: updatedUser.id,
            username: updatedUser.username,
            tipo: "Cuenta suspendida por intentos",
            ip: clientIp,
            detalle: `Cuenta suspendida tras intentos fallidos`,
            nivel: "alto",
          });
          return res.status(401).json({ 
            message: "Cuenta Suspendida (3 horas)"
          });
        }
        
        logger.actividad({
          usuarioId: updatedUser.id,
          username: updatedUser.username,
          accion: "login_fail",
          modulo: "Autenticación",
          resultado: "error",
          ip: clientIp,
          metadata: { motivo: "password_invalido" },
        });
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Check if user already has an active session
      const hasActiveSession = await storage.isSessionActive(updatedUser.id);
      if (hasActiveSession) {
        return res.status(401).json({ 
          message: "Ya tienes una sesión activa. Cierra la sesión actual antes de iniciar una nueva."
        });
      }

      // Reset failed attempts on successful login
      await storage.resetFailedAttempts(username);

      // Actualizar último acceso y dirección IP
      await storage.updateUserLastAccess(updatedUser.id, clientIp);

      const token = jwt.sign(
        { id: updatedUser.id, username: updatedUser.username, rol: updatedUser.rol },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Set session token and expiration (24 hours)
      const sessionExpires = new Date();
      sessionExpires.setHours(sessionExpires.getHours() + 24);
      await storage.setUserSession(updatedUser.id, token, sessionExpires);

      res.json({
        token,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          nombre: updatedUser.nombre,
          email: updatedUser.email,
          rol: updatedUser.rol,
        },
      });

      logger.actividad({
        usuarioId: updatedUser.id,
        username: updatedUser.username,
        accion: "login",
        modulo: "Autenticación",
        resultado: "exitoso",
        ip: clientIp,
      });
    } catch (error) {
      // Login error - handle gracefully
      res.status(400).json({ message: "Error en el login" });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      // Clear the user's session
      await storage.clearUserSession(user.id);
      res.json({ message: "Sesión cerrada exitosamente" });

      logger.actividad({
        usuarioId: user.id,
        username: user.username,
        accion: "logout",
        modulo: "Autenticación",
        resultado: "exitoso",
        ip: (req as any).clientIp,
      });
    } catch (error) {
      // Logout error - handle gracefully
      res.status(500).json({ message: "Error al cerrar sesión" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    const user = req.user;
    res.json({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
    });
  });

  // Dashboard Routes - role-based
  app.get("/api/dashboard/stats", authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user.rol;
      
      // For regular users, show data by their coordination
      let stats;
      if (userRole === "usuario") {
        stats = await storage.getDashboardStatsByUser(req.user.id);
      } else {
        // Admins and supervisors can see all data
        stats = await storage.getDashboardStats();
      }
      
      res.json(stats);
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({ message: "Error obteniendo estadísticas" });
    }
  });

  // Solicitudes Routes - role-based
  app.get("/api/solicitudes", authenticateToken, async (req: any, res) => {
    try {
      const filters = {
        operador: req.query.operador as string,
        estado: req.query.estado as string,
        tipoExperticia: req.query.tipoExperticia as string,
        coordinacion: req.query.coordinacion as string,
        search: req.query.search as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
      };

        // For regular users, filter by their coordination
      if (req.user.rol === "usuario") {
        // Users can only see requests from their coordination
        if (!req.user.coordinacion) {
        return res.status(403).json({ message: "Usuario sin coordinación asignada" });
      }
  
          // Add coordination filter to existing filters
          const coordinacionFilters = { 
          ...filters, 
          coordinacionSolicitante: req.user.coordinacion 
        };
        const result = await storage.getSolicitudes(coordinacionFilters);
        res.json(result);
      } else {
        // Admins and supervisors can see all requests with optional coordination filter
        const adminFilters: any = { ...filters };
        if (adminFilters.coordinacion && adminFilters.coordinacion !== "todos") {
          adminFilters.coordinacionSolicitante = adminFilters.coordinacion;
        }
        delete adminFilters.coordinacion; // Remove coordinacion from filters, use coordinacionSolicitante instead
        
        const result = await storage.getSolicitudes(adminFilters);
        res.json(result);
      }
    } catch (error) {
      // Error getting requests - handle gracefully  
      res.status(500).json({ message: "Error obteniendo solicitudes" });
    }
  });

  app.get("/api/solicitudes/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const solicitud = await storage.getSolicitudById(id);
      
      if (!solicitud) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }

      res.json(solicitud);
    } catch (error) {
      // Error getting request by ID - handle gracefully
      res.status(500).json({ message: "Error obteniendo solicitud" });
    }
  });

  app.post("/api/solicitudes", authenticateToken, async (req: any, res) => {
    try {
      // Input validation
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: "Datos de solicitud requeridos" });
      }

      // Role-based validation: supervisor and usuario can only create requests with "enviada" status
      if ((req.user.rol === "supervisor" || req.user.rol === "usuario") && req.body.estado && req.body.estado !== "enviada") {
        return res.status(403).json({ 
          message: "Los usuarios con rol supervisor y usuario solo pueden crear solicitudes con estado 'enviada'" 
        });
      }

      // Force estado to "enviada" for supervisor and usuario roles
      const requestData = { ...req.body };
      if (req.user.rol === "supervisor" || req.user.rol === "usuario") {
        requestData.estado = "enviada";
      }

      const solicitudData = insertSolicitudSchema.parse({
        ...requestData,
        usuarioId: req.user.id,
      });

      // Input sanitization is now handled by Zod schema transforms

      // Verificar que el número de solicitud no exista
      const existingSolicitud = await storage.getSolicitudByNumero(solicitudData.numeroSolicitud);
      if (existingSolicitud) {
        return res.status(400).json({ 
          message: "El número de solicitud ya existe. Por favor, ingrese un número único." 
        });
      }

      const solicitud = await storage.createSolicitud(solicitudData);
      
      // Crear historial y notificaciones en paralelo
      const promises = [
        storage.createHistorial({
          solicitudId: solicitud.id,
          accion: "creada",
          descripcion: "Solicitud creada",
          usuarioId: req.user.id,
        })
      ];

      // Si la solicitud se crea con estado "enviada", notificar a los administradores
      if (solicitud.estado === "enviada") {
        promises.push(
          storage.notifyAdminsOfSentRequest(solicitud.id, solicitud.numeroSolicitud).then(() => ({
            id: 0,
            createdAt: null,
            usuarioId: null,
            descripcion: null,
            solicitudId: null,
            accion: "notification_sent"
          }))
        );
      }

      await Promise.all(promises);

      // Generar documentos automáticamente después de crear la solicitud
      try {
        // Preparar datos para generación de documentos
        const documentData = {
          ...solicitudData,
          // Incluir datos parseados si existen en el body original
          informacionE: requestData.informacionE || '',
          informacionR: requestData.informacionR || '',
          desde: requestData.desde || '',
          hasta: requestData.hasta || ''
        };
        
        // Intentar generar documento Word y Excel en paralelo
        const [wordBuffer, excelBuffer] = await Promise.all([
          generateWordDocument(documentData, storage),
          generateExcelDocument(documentData)
        ]);
              
      } catch (docError) {
        console.error("Error en generación automática de documentos:", docError);
        // No fallar la creación de solicitud si los documentos no se pueden generar
      }

      res.status(201).json(solicitud);

      logger.actividad({
        usuarioId: req.user.id,
        username: req.user.username,
        accion: "solicitud_create",
        modulo: "Solicitudes",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        metadata: { numero_solicitud: solicitud.numeroSolicitud, numero_expediente: solicitud.numeroExpediente },
      });
    } catch (error) {
      // Error creating request - handle validation and database errors
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validationErrors
        });
      }
      
      // Check for duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return res.status(400).json({ message: "Número de Solicitud Duplicada" });
      }
      
      res.status(500).json({ message: "Error creando solicitud" });
    }
  });

  app.put("/api/solicitudes/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get current solicitud to check its status
      const currentSolicitud = await storage.getSolicitudById(id);
      if (!currentSolicitud) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }

      // Only admins can edit requests that are not in "enviada" status
      if (currentSolicitud.estado !== "enviada" && req.user.rol !== "admin") {
        return res.status(403).json({ 
          message: "Solo los administradores pueden editar solicitudes con estado diferente a 'enviada'" 
        });
      }
      
      // Role-based validation: supervisor and usuario can only update to "enviada" status
      if ((req.user.rol === "supervisor" || req.user.rol === "usuario") && req.body.estado && req.body.estado !== "enviada") {
        return res.status(403).json({ 
          message: "Los usuarios con rol supervisor y usuario solo pueden establecer el estado como 'enviada'" 
        });
      }

      // Force estado to "enviada" for supervisor and usuario roles if they're trying to change it
      const requestData = { ...req.body };
      if ((req.user.rol === "supervisor" || req.user.rol === "usuario") && requestData.estado) {
        requestData.estado = "enviada";
      }

      const solicitudData = insertSolicitudSchema.partial().parse(requestData);

      // Verificar que el número de solicitud no exista (si se está actualizando)
      if (solicitudData.numeroSolicitud) {
        const existingSolicitud = await storage.getSolicitudByNumero(solicitudData.numeroSolicitud);
        if (existingSolicitud && existingSolicitud.id !== id) {
          return res.status(400).json({ 
            message: "El número de solicitud ya existe. Por favor, ingrese un número único." 
          });
        }
      }

      const solicitud = await storage.updateSolicitud(id, solicitudData);
      
      if (!solicitud) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }

      // Create notification when status changes
      if (solicitudData.estado && solicitudData.estado !== currentSolicitud.estado) {
        const statusNames = {
          procesando: "Procesando",
          enviada: "Enviada",
          respondida: "Respondida",
          rechazada: "Rechazada"
        };
        
        let mensaje = `Solicitud ${solicitud.numeroSolicitud} cambió a estado: ${statusNames[solicitudData.estado as keyof typeof statusNames]}`;
        
        // If rejected, include rejection reason
        if (solicitudData.estado === "rechazada" && solicitudData.motivoRechazo) {
          mensaje += ` - Motivo: ${solicitudData.motivoRechazo}`;
        }
        
        // Notify the user who created the request
        if (solicitud.usuarioId) {
          await storage.createNotificacion(solicitud.usuarioId, solicitud.id, mensaje);
        }

        // If status changed to "enviada", notify admins
        if (solicitudData.estado === "enviada") {
          await storage.notifyAdminsOfSentRequest(solicitud.id, solicitud.numeroSolicitud);
        }
      }

      // Crear historial
      await storage.createHistorial({
        solicitudId: solicitud.id,
        accion: "actualizada",
        descripcion: "Solicitud actualizada",
        usuarioId: req.user.id,
      });

      res.json(solicitud);

      logger.actividad({
        usuarioId: req.user.id,
        username: req.user.username,
        accion: "solicitud_update",
        modulo: "Solicitudes",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        metadata: { solicitud_id: solicitud.id, numero_solicitud: solicitud.numeroSolicitud },
      });
    } catch (error) {
      // Error actualizando solicitud:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      
      // Check for duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return res.status(400).json({ message: "Número de Solicitud Duplicada" });
      }
      
      res.status(500).json({ message: "Error actualizando solicitud" });
    }
  });

  app.delete("/api/solicitudes/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get current solicitud to check its status
      const currentSolicitud = await storage.getSolicitudById(id);
      if (!currentSolicitud) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }

      // Only admins can delete requests that are not in "enviada" status
      if (currentSolicitud.estado !== "enviada" && req.user.rol !== "admin") {
        return res.status(403).json({ 
          message: "Solo los administradores pueden eliminar solicitudes con estado diferente a 'enviada'" 
        });
      }
      
      const deleted = await storage.deleteSolicitud(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }

      res.json({ message: "Solicitud eliminada exitosamente" });

      logger.actividad({
        usuarioId: req.user.id,
        username: req.user.username,
        accion: "solicitud_delete",
        modulo: "Solicitudes",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        metadata: { solicitud_id: id, numero_solicitud: currentSolicitud.numeroSolicitud },
      });
    } catch (error) {
      // Error eliminando solicitud:", error);
      res.status(500).json({ message: "Error eliminando solicitud" });
    }
  });

  // Plantillas Routes
  app.get("/api/plantillas", authenticateToken, async (req: any, res) => {
    try {
      const plantillas = await storage.getPlantillasCorreo(req.user.id);
      res.json(plantillas);
    } catch (error) {
      // Error obteniendo plantillas:", error);
      res.status(500).json({ message: "Error obteniendo plantillas" });
    }
  });

  app.post("/api/plantillas", authenticateToken, async (req: any, res) => {
    try {
      const plantillaData = insertPlantillaCorreoSchema.parse({
        ...req.body,
        usuarioId: req.user.id,
      });

      const plantilla = await storage.createPlantillaCorreo(plantillaData);
      res.status(201).json(plantilla);
    } catch (error) {
      // Error creando plantilla:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error creando plantilla" });
    }
  });

  app.put("/api/plantillas/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const plantillaData = insertPlantillaCorreoSchema.partial().parse(req.body);

      const plantilla = await storage.updatePlantillaCorreo(id, plantillaData);
      
      if (!plantilla) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }

      res.json(plantilla);
    } catch (error) {
      // Error actualizando plantilla:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error actualizando plantilla" });
    }
  });

  app.delete("/api/plantillas/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePlantillaCorreo(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }

      res.json({ message: "Plantilla eliminada exitosamente" });
    } catch (error) {
      // Error eliminando plantilla:", error);
      res.status(500).json({ message: "Error eliminando plantilla" });
    }
  });

  // Users Routes (Admin only)
  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.rol !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
    next();
  };

  const requireAdminOrSupervisor = (req: any, res: any, next: any) => {
    if (req.user?.rol !== 'admin' && req.user?.rol !== 'supervisor') {
      return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador o supervisor.' });
    }
    next();
  };

  app.get("/api/users", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const filters = {
        search: req.query.search as string,
        status: req.query.status as string,
        rol: req.query.rol as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
      };

      const result = await storage.getUsers(filters);
      res.json(result);
    } catch (error) {
      // Error obteniendo usuarios:", error);
      res.status(500).json({ message: "Error obteniendo usuarios" });
    }
  });

  app.post("/api/users", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      // Transform date fields from string to Date if provided
      const bodyData = { ...req.body };
      
      // Clean up and transform date fields
      if (bodyData.tiempoSuspension && bodyData.tiempoSuspension !== '' && bodyData.tiempoSuspension !== null) {
        bodyData.tiempoSuspension = new Date(bodyData.tiempoSuspension);
      } else {
        delete bodyData.tiempoSuspension;
      }
      
      if (bodyData.fechaSuspension && bodyData.fechaSuspension !== '' && bodyData.fechaSuspension !== null) {
        bodyData.fechaSuspension = new Date(bodyData.fechaSuspension);
      } else {
        delete bodyData.fechaSuspension;
      }

      const userData = insertUserSchema.parse(bodyData);
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const userDataWithHashedPassword = {
        ...userData,
        password: hashedPassword,
        // Auto-assign IP address if not provided
        direccionIp: userData.direccionIp || (req as any).clientIp || 'unknown',
      };

      const user = await storage.createUser(userDataWithHashedPassword);
      
      // Remove password from response
      const { password, ...userResponse } = user;
      res.status(201).json(userResponse);
    } catch (error) {
      // Error creando usuario:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      if ((error as any).code === '23505') { // unique constraint violation
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }
      res.status(500).json({ message: "Error creando usuario" });
    }
  });

  app.patch("/api/users/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Transform date fields from string to Date if provided
      const bodyData = { ...req.body };
      
      // Clean up and transform date fields
      if (bodyData.tiempoSuspension && bodyData.tiempoSuspension !== '' && bodyData.tiempoSuspension !== null) {
        bodyData.tiempoSuspension = new Date(bodyData.tiempoSuspension);
      } else {
        delete bodyData.tiempoSuspension;
      }
      
      if (bodyData.fechaSuspension && bodyData.fechaSuspension !== '' && bodyData.fechaSuspension !== null) {
        bodyData.fechaSuspension = new Date(bodyData.fechaSuspension);
      } else {
        delete bodyData.fechaSuspension;
      }

      const userData = insertUserSchema.partial().parse(bodyData);

      // If password is provided, hash it
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      // Auto-assign IP address if not provided but is being updated
      if (userData.direccionIp === '' || userData.direccionIp === undefined) {
        userData.direccionIp = (req as any).clientIp || 'unknown';
      }

      const user = await storage.updateUser(id, userData);
      
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Remove password from response
      const { password, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      // Error actualizando usuario:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      if ((error as any).code === '23505') { // unique constraint violation
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }
      res.status(500).json({ message: "Error actualizando usuario" });
    }
  });

  app.delete("/api/users/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Prevent deleting self
      if (id === req.user.id) {
        return res.status(400).json({ message: "No puedes eliminar tu propia cuenta" });
      }

      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json({ message: "Usuario eliminado exitosamente" });
    } catch (error) {
      // Error eliminando usuario:", error);
      res.status(500).json({ message: "Error eliminando usuario" });
    }
  });

  // Historial Routes
  app.get("/api/solicitudes/:id/historial", authenticateToken, async (req, res) => {
    try {
      const solicitudId = parseInt(req.params.id);
      const historial = await storage.getHistorialBySolicitud(solicitudId);
      res.json(historial);
    } catch (error) {
      // Error obteniendo historial:", error);
      res.status(500).json({ message: "Error obteniendo historial" });
    }
  });

  // Notifications routes
  app.get("/api/notifications", authenticateToken, async (req: any, res) => {
    try {
      const notifications = await storage.getNotificacionesByUser(req.user.id);
      res.json(notifications);
    } catch (error) {
      // Error obteniendo notificaciones:", error);
      res.status(500).json({ message: "Error obteniendo notificaciones" });
    }
  });

  app.put("/api/notifications/:id/read", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.markNotificacionAsRead(id);
      res.json({ message: "Notificación marcada como leída" });
    } catch (error) {
      // Error marcando notificación como leída:", error);
      res.status(500).json({ message: "Error marcando notificación como leída" });
    }
  });

  app.get("/api/notifications/unread-count", authenticateToken, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationsCount(req.user.id);
      res.json({ count });
    } catch (error) {
      // Error obteniendo conteo de notificaciones:", error);
      res.status(500).json({ message: "Error obteniendo conteo de notificaciones" });
    }
  });

  // Guide PDF Generation Route
  app.get("/api/guide/pdf", authenticateToken, async (req: any, res) => {
    try {
      const guideContent = generateUserGuideHTML();
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', 'inline; filename="guia-usuario-ter-system.html"');
      
      res.send(guideContent);
    } catch (error) {
      // Error generando guía:", error);
      res.status(500).json({ message: "Error generando guía de usuario" });
    }
  });

  // Plantillas Word Routes
  app.get("/api/plantillas-word", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const tipoExperticia = req.query.tipoExperticia as string;
      const plantillas = await storage.getPlantillasWord(tipoExperticia);
      res.json(plantillas);
    } catch (error) {
      // Error obteniendo plantillas Word:", error);
      res.status(500).json({ message: "Error obteniendo plantillas Word" });
    }
  });

  app.post("/api/plantillas-word", authenticateToken, requireAdmin, upload.single('archivo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó archivo" });
      }

      const { nombre, tipoExperticia, tipoPlantilla } = req.body;
      
      // Validate request body
      if (!nombre || !tipoExperticia || !tipoPlantilla) {
        return res.status(400).json({ message: "Nombre, tipo de experticia y tipo de plantilla son requeridos" });
      }

      // Check if a template already exists for this combination of expertise type and template type
      const existingTemplate = await storage.getPlantillaWordByTipoExperticiaTipoPlantilla(tipoExperticia, tipoPlantilla);
      if (existingTemplate) {
        return res.status(400).json({ message: `Ya existe una plantilla de tipo ${tipoPlantilla} para este tipo de experticia` });
      }

      // Generate unique filename
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `plantilla-${tipoExperticia}-${Date.now()}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      // Save file to disk
      writeFileSync(filePath, req.file.buffer);

      // Create template record
      const plantillaData = {
        nombre,
        tipoExperticia,
        tipoPlantilla,
        archivo: filePath,
        nombreArchivo: req.file.originalname,
        tamaño: req.file.size,
        usuarioId: req.user.id,
      };

      const plantilla = await storage.createPlantillaWord(plantillaData);
      res.json(plantilla);
    } catch (error) {
      // Error creando plantilla Word:", error);
      res.status(500).json({ message: "Error creando plantilla Word" });
    }
  });

  app.get("/api/plantillas-word/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const plantilla = await storage.getPlantillaWordById(id);
      
      if (!plantilla) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }

      res.json(plantilla);
    } catch (error) {
      // Error obteniendo plantilla Word:", error);
      res.status(500).json({ message: "Error obteniendo plantilla Word" });
    }
  });

  // Codigo de Generacion de Planilla
  //Descargar Plantilla Original por ID 
 
  app.post("/api/config/download-format", authenticateToken, requireAdmin, async (req: any, res) => {
    // Aquí puedes actualizar la variable o el objeto
    const { downloadAsPdf } = req.body;
      
    // O actualizar objeto de configuración
    swiPdf.downloadAsPdf = downloadAsPdf;
});

  app.get("/api/plantillas-word/:id/download", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const plantilla = await storage.getPlantillaWordById(id);
      
      if (!plantilla) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }

      // Check if file exists
      if (!existsSync(plantilla.archivo)) {
        return res.status(404).json({ message: "Archivo no encontrado" });
      }

      // Read file and send it
      const fileBuffer = readFileSync(plantilla.archivo);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${plantilla.nombreArchivo}"`);
      res.send(fileBuffer);
    } catch (error) {
      // Error descargando plantilla Word:", error);
      res.status(500).json({ message: "Error descargando plantilla Word" });
    }
  });

  app.delete("/api/plantillas-word/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const plantilla = await storage.getPlantillaWordById(id);
      
      if (!plantilla) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }

      // Delete file from disk
      if (existsSync(plantilla.archivo)) {
        unlinkSync(plantilla.archivo);
      }

      // Delete record from database
      const deleted = await storage.deletePlantillaWord(id);
      
      if (deleted) {
        res.json({ message: "Plantilla eliminada exitosamente" });
      } else {
        res.status(500).json({ message: "Error eliminando plantilla" });
      }
    } catch (error) {
      // Error eliminando plantilla Word:", error);
      res.status(500).json({ message: "Error eliminando plantilla Word" });
    }
  });

  // Ruta para obtener plantilla por tipo de experiencia (para descarga automática)
  app.get("/api/plantillas-word/by-expertise/:tipoExperticia", authenticateToken, async (req: any, res) => {
    try {
      const tipoExperticia = req.params.tipoExperticia;
      const plantilla = await storage.getPlantillaWordByTipoExperticia(tipoExperticia);
      
      if (!plantilla) {
        return res.status(404).json({ message: "No hay plantilla disponible para este tipo de experticia" });
      }

      // Check if file exists
      if (!existsSync(plantilla.archivo)) {
        return res.status(404).json({ message: "Archivo no encontrado" });
      }

      // Read file and send it
      const fileBuffer = readFileSync(plantilla.archivo);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${plantilla.nombreArchivo}"`);
      res.send(fileBuffer);
    } catch (error) {
      // Error descargando plantilla por experticia:", error);
      res.status(500).json({ message: "Error descargando plantilla" });
    }
  });

app.post("/api/plantillas-word/by-expertise/:tipoExperticia/generate", authenticateToken, async (req: any, res) => {
  try {
    const { tipoExperticia } = req.params;
    const requestData = req.body;


    // 1. Validar existencia de plantilla y archivo (más conciso)
    const plantilla = await storage.getPlantillaWordByTipoExperticia(tipoExperticia);
    if (!plantilla) {
      return res.status(404).json({ message: "No hay plantilla disponible para este tipo de experticia" });
    }
    if (!existsSync(plantilla.archivo)) {
      return res.status(404).json({ message: "Archivo de plantilla no encontrado" });
    }
    // 2. Preparar datos para la plantilla
    const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const solicitudShort = requestData.numeroSolicitud?.split('-').pop() || requestData.numeroSolicitud || ''; // Uso de optional chaining y nullish coalescing

    // Extraer prefijos de informacionLinea
    const abonado = parseWithPrefixes(requestData.informacionLinea || '', ['e', 'r']);
    const fecha = parseWithPrefixes(requestData.fecha_de_solicitud || '', ['desde', 'hasta']);

      console.log('=== GENERACIÓN PLANILLA WORD ===');
      console.log('Tipo de Experticia:', tipoExperticia);
      console.log('¿Es Contacto Frecuente?:', tipoExperticia === 'determinar_contacto_frecuente');
      console.log('Datos recibidos del frontend (requestData):');
      console.log('  - informacionLinea (sin parsear):', requestData.informacionLinea);
      console.log('  - informacionE (parseado):', abonado .e);
      console.log('  - informacionR (parseado):', abonado .r);
      console.log('  - fecha (sin parsear):', requestData.fecha);
      console.log('  - desde (parseado):', fecha.desde);
      console.log('  - hasta (parseado):', fecha.hasta);
      


    const templateData = {
      // Uso de un único estilo de nombre para los placeholders
      OFI: (requestData.coordinacionSolicitante.includes('delitos_propiedad')) 
         ? 'CIDCPROP' 

         : (requestData.coordinacionSolicitante.includes('delitos_personas')) 
         ? 'CIDCPER' 
          
         : (requestData.coordinacionSolicitante.includes('crimen_organizado')) 
         ? 'COLOCAR IDENTIFICADOR'

         : (requestData.coordinacionSolicitante.includes('delitos_vehiculos')) 
         ? 'CIRHV'
        
         : (requestData.coordinacionSolicitante.includes('homicidio')) 
         ? 'CIDCPER'

         : 'IDENTIFICAR OFICINA POR FAVOR!!!',  // Valor por defecto,

      SOLICITUD: solicitudShort,
      EXP: requestData.numeroExpediente || '',
      OPER: (requestData.operador || '').toUpperCase(),
      FECHA: currentDate,
      FISCAL: requestData.fiscal || '',
      DIR: requestData.direc || '',
      INFO_E: abonado .e || requestData.informacionE || '',
      INFO_R: abonado .r || requestData.informacionR || '',
      DESDE: fecha.desde || '', // iNTRODUCIR
      HASTA: fecha.hasta || '',      // INTRODUCIR
      DELITO: requestData.delito || '',
      
      /*
      informacionLinea: requestData.informacionLinea || '',
      descripcion: requestData.descripcion || '', */
    };

    console.log('Datos preparados para la plantilla Word (templateData):');
    console.log('  - INFO_E:', templateData.INFO_E);
    console.log('  - INFO_R:', templateData.INFO_R);
    console.log('  - DESDE:', templateData.DESDE);
    console.log('  - HASTA:', templateData.HASTA);
    console.log('Template Data completo:', JSON.stringify(templateData, null, 2));

    let busArhivo: Buffer; // Variable para almacenar el buffer del archivo a enviar
    
    // Colocar Condicional Aquí
    if (swiPdf.downloadAsPdf) { // Suponiendo que 'esPDF' es una propiedad en requestData que indica si es PDF
      
      // Aquí podrías agregar la lógica para generar un PDF si fuera necesario,
      // o simplemente terminar la ejecución si solo se espera imprimir "PDF"
      return res.status(200).json({ message: "Se solicitó la generación de PDF." });
    } else {
      try {
        // Leer el archivo de la plantilla
        const content = readFileSync(plantilla.archivo, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });

        console.log('Iniciando renderizado del documento Word con docxtemplater...');
        
        // Generar Documento con Datos
        doc.render(templateData);

        // Obtener el buffer del documento generado con los datos
        busArhivo = doc.getZip().generate({ type: 'nodebuffer' });
        
        console.log('Documento Word generado exitosamente');

      } catch (renderError: any) {
        // Si el renderizado falla, registramos el error y usamos la plantilla original
        console.error("Error al renderizar la plantilla con docxtemplater:", renderError);
        busArhivo = readFileSync(plantilla.archivo); // Usar la plantilla original
      }
      // 3. Configurar y enviar la respuesta (consolidado) (Nombre)
      const customFileName = `${plantilla.nombre}-${requestData.numeroSolicitud || 'plantilla'}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${customFileName}"`);
      res.send(busArhivo);
    }

  } catch (error) {
    // Manejo de errores generales (ej. problemas de base de datos o acceso a archivos antes del renderizado)
    res.status(500).json({ message: "Error generando plantilla personalizada" });
  }
});// Final de word

  
  // Registrar rutas de gestión de documentos (Word y Excel)
  registerDocumentRoutes(app, authenticateToken, storage);

  // Registrar rutas del chatbot AI
  registerChatbotRoutes(app, authenticateToken, requireAdmin, storage);

  // Registrar rutas de estadísticas
  registerStatsRoutes(app, authenticateToken);
  registerAnalisisRoutes(app, authenticateToken, requireAdmin, uploadData);
  const httpServer = createServer(app);
  return httpServer;
}