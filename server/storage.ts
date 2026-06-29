import {
  users,
  solicitudes,
  plantillasCorreo,
  historialSolicitudes,
  notificaciones,
  plantillasWord,
  configuracionSistema,
  chatbotMensajes,
  experticias,
  personasCasos,
  personaTelefonos,
  registrosComunicacion,
  expedientesSujetos,
  type User,
  type InsertUser,
  type Solicitud,
  type InsertSolicitud,
  type PlantillaCorreo,
  type InsertPlantillaCorreo,
  type PlantillaWord,
  type InsertPlantillaWord,
  type HistorialSolicitud,
  type InsertHistorialSolicitud,
  type ConfiguracionSistema,
  type InsertConfiguracionSistema,
  type ChatbotMensaje,
  type InsertChatbotMensaje,
  type Experticia,
  type InsertExperticia,
  type PersonaCaso,
  type InsertPersonaCaso,
  type ExpedienteSujeto,
  type InsertExpedienteSujeto,
  type PersonaTelefono,
  type InsertPersonaTelefono,
  type RegistroComunicacion,
  type InsertRegistroComunicacion,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ne, like, count, sql, lt, inArray, notInArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(filters?: {
    search?: string;
    status?: string;
    rol?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number }>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  updateUserLastAccess(id: number, ip?: string): Promise<void>;
  incrementFailedAttempts(username: string): Promise<void>;
  resetFailedAttempts(username: string): Promise<void>;
  checkAndSuspendUser(username: string): Promise<boolean>;
  checkSuspensionExpired(userId: number): Promise<boolean>;
  notifyAdminsOfSentRequest(solicitudId: number, numeroSolicitud: string): Promise<void>;
  notifyUserSuspensionLifted(userId: number): Promise<void>;
  notifyAdminsOfFailedLoginSuspension(username: string, ip: string): Promise<void>;
  cleanupOldNotifications(): Promise<void>;

  // Session management
  setUserSession(userId: number, sessionToken: string, expiresAt: Date): Promise<void>;
  clearUserSession(userId: number): Promise<void>;
  getUserBySessionToken(sessionToken: string): Promise<User | undefined>;
  isSessionActive(userId: number): Promise<boolean>;

  // Solicitudes
  getSolicitudes(filters?: {
    operador?: string;
    estado?: string;
    tipoExperticia?: string;
    search?: string;
    coordinacionSolicitante?: string;
    page?: number;
    limit?: number;
  }): Promise<{ solicitudes: Solicitud[]; total: number }>;

  getSolicitudesByUser(userId: number, filters?: {
    operador?: string;
    estado?: string;
    tipoExperticia?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ solicitudes: Solicitud[]; total: number }>;


  getSolicitudById(id: number): Promise<Solicitud | undefined>;
  getSolicitudByNumero(numeroSolicitud: string): Promise<Solicitud | undefined>;
  createSolicitud(solicitud: InsertSolicitud): Promise<Solicitud>;
  updateSolicitud(id: number, solicitud: Partial<InsertSolicitud>): Promise<Solicitud | undefined>;
  deleteSolicitud(id: number): Promise<boolean>;

  // Plantillas de correo
  getPlantillasCorreo(usuarioId?: number): Promise<PlantillaCorreo[]>;
  getPlantillaCorreoById(id: number): Promise<PlantillaCorreo | undefined>;

  // Plantillas Word
  getPlantillasWord(tipoExperticia?: string): Promise<PlantillaWord[]>;
  getPlantillaWordById(id: number): Promise<PlantillaWord | undefined>;
  getPlantillaWordByTipoExperticia(tipoExperticia: string): Promise<PlantillaWord | undefined>;
  getPlantillaWordByTipoExperticiaTipoPlantilla(tipoExperticia: string, tipoPlantilla: string): Promise<PlantillaWord | undefined>;
  createPlantillaWord(plantilla: InsertPlantillaWord): Promise<PlantillaWord>;
  updatePlantillaWord(id: number, plantilla: Partial<InsertPlantillaWord>): Promise<PlantillaWord | undefined>;
  deletePlantillaWord(id: number): Promise<boolean>;

  createPlantillaCorreo(plantilla: InsertPlantillaCorreo): Promise<PlantillaCorreo>;
  updatePlantillaCorreo(id: number, plantilla: Partial<InsertPlantillaCorreo>): Promise<PlantillaCorreo | undefined>;
  deletePlantillaCorreo(id: number): Promise<boolean>;

  // Historial
  createHistorial(historial: InsertHistorialSolicitud): Promise<HistorialSolicitud>;
  getHistorialBySolicitud(solicitudId: number): Promise<HistorialSolicitud[]>;

  // Notificaciones
  createNotificacion(userId: number, solicitudId: number, mensaje: string): Promise<void>;
  getNotificacionesByUser(userId: number): Promise<any[]>;
  markNotificacionAsRead(notificationId: number): Promise<void>;
  getUnreadNotificationsCount(userId: number): Promise<number>;

  // Dashboard stats
  getDashboardStats(): Promise<{
    totalSolicitudes: number;
    pendientes: number;
    enviadas: number;
    respondidas: number;
    rechazadas: number;
    solicitudesPorOperador: { operador: string; total: number }[];
    actividadReciente: any[];
  }>;

  getDashboardStatsByUser(userId: number): Promise<{
    totalSolicitudes: number;
    pendientes: number;
    enviadas: number;
    respondidas: number;
    rechazadas: number;
    solicitudesPorOperador: { operador: string; total: number }[];
    actividadReciente: any[];
  }>;

  // Chatbot management
  getChatbotConfig(clave: string): Promise<ConfiguracionSistema | undefined>;
  setChatbotConfig(clave: string, valor: string, usuarioId: number, descripcion?: string): Promise<void>;
  getUserChatbotStatus(userId: number): Promise<{ habilitado: boolean; mensajesUsados: number; limite: number }>;
  updateUserChatbotLimits(userId: number, limite: number, habilitado: boolean): Promise<void>;
  incrementUserChatbotMessages(userId: number): Promise<boolean>; // Returns true if still under limit
  resetUserChatbotMessages(userId: number): Promise<void>;
  saveChatbotMessage(usuarioId: number, mensaje: string, respuesta: string, tieneArchivo?: boolean, nombreArchivo?: string): Promise<void>;
  getChatbotMessagesByUser(userId: number, limit?: number): Promise<ChatbotMensaje[]>;
  getUsersWithChatbotStats(): Promise<{ usuario: User; mensajesUsados: number; limite: number; habilitado: boolean }[]>;
  bulkUpdateChatbotLimits(updates: { userId: number; limite: number; habilitado: boolean }[]): Promise<void>;

  // Experticias
  getExperticias(filters?: {
    operador?: string;
    estado?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ experticias: Experticia[]; total: number }>;
  getExperticia(id: number): Promise<Experticia | undefined>;
  createExperticia(experticia: InsertExperticia): Promise<Experticia>;
  updateExperticia(id: number, experticia: Partial<InsertExperticia>): Promise<Experticia | undefined>;
  deleteExperticia(id: number): Promise<boolean>;
  getExperticiasStats(): Promise<{ total: number; completadas: number; procesando: number; negativas: number; qr_ausente: number }>;

  // Personas Casos - Análisis de Trazabilidad
  getPersonasCasos(filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ personasCasos: PersonaCaso[]; total: number }>;
  getPersonaCasoById(nro: number): Promise<PersonaCaso | undefined>;
  getPersonaCasoByTelefono(telefono: string): Promise<PersonaCaso | undefined>;
  findPersonaByCedula(cedula: string): Promise<PersonaCaso | undefined>;
  createPersonaCaso(personaCaso: InsertPersonaCaso): Promise<PersonaCaso>;
  updatePersonaCaso(nro: number, personaCaso: Partial<InsertPersonaCaso>): Promise<PersonaCaso | undefined>;
  deletePersonaCaso(nro: number): Promise<boolean>;
  upsertPersonaCasoByAbonado(abonado: string, data: Partial<InsertPersonaCaso>): Promise<PersonaCaso>;

  // Expedientes Sujetos - Datos del caso por persona
  createExpedienteSujeto(data: InsertExpedienteSujeto): Promise<ExpedienteSujeto>;
  getExpedientesSujetosByPersonaId(personaId: number): Promise<ExpedienteSujeto[]>;
  getExpedienteSujetoById(id: number): Promise<ExpedienteSujeto | undefined>;
  updateExpedienteSujeto(id: number, data: Partial<InsertExpedienteSujeto>): Promise<ExpedienteSujeto | undefined>;
  deleteExpedienteSujeto(id: number): Promise<boolean>;

  // Persona Teléfonos - Catálogo de números
  getPersonaTelefonos(personaId: number): Promise<PersonaTelefono[]>;
  getPersonaTelefonoById(id: number): Promise<PersonaTelefono | undefined>;
  getPersonaTelefonoByNumero(numero: string): Promise<PersonaTelefono | undefined>;
  createPersonaTelefono(telefono: InsertPersonaTelefono): Promise<PersonaTelefono>;
  createPersonaTelefonosBulk(telefonos: InsertPersonaTelefono[]): Promise<PersonaTelefono[]>;
  updatePersonaTelefono(id: number, telefono: Partial<InsertPersonaTelefono>): Promise<PersonaTelefono | undefined>;
  deletePersonaTelefono(id: number): Promise<boolean>;
  deletePersonaTelefonosByPersona(personaId: number): Promise<boolean>;

  // Registros Comunicación - Análisis de Trazabilidad
  getRegistrosComunicacion(filters?: {
    abonadoA?: string;
    abonadoB?: string;
    fecha?: string;
    page?: number;
    limit?: number;
  }): Promise<{ registros: RegistroComunicacion[]; total: number }>;
  getRegistroComunicacionById(registroId: number): Promise<RegistroComunicacion | undefined>;
  getRegistrosComunicacionByAbonado(abonado: string): Promise<RegistroComunicacion[]>;
  getRegistrosComunicacionByTelefonoIds(telefonoIds: number[]): Promise<RegistroComunicacion[]>;
  createRegistroComunicacion(registro: InsertRegistroComunicacion): Promise<RegistroComunicacion>;
  createRegistrosComunicacionBulk(registros: InsertRegistroComunicacion[]): Promise<void>;
  updateRegistroComunicacion(registroId: number, registro: Partial<InsertRegistroComunicacion>): Promise<RegistroComunicacion | undefined>;
  deleteRegistroComunicacion(registroId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(filters?: {
    search?: string;
    status?: string;
    rol?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    let whereConditions: any[] = [];

    if (filters?.search) {
      whereConditions.push(
        or(
          like(users.nombre, `%${filters.search}%`),
          like(users.username, `%${filters.search}%`),
          like(users.email, `%${filters.search}%`)
        )
      );
    }

    if (filters?.status) {
      if (filters.status === "inactivo") {
        whereConditions.push(eq(users.activo, false));
      } else {
        whereConditions.push(eq(users.status, filters.status as any));
      }
    }

    if (filters?.rol) {
      whereConditions.push(eq(users.rol, filters.rol));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [usersResult, totalResult] = await Promise.all([
      db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(users)
        .where(whereClause)
    ]);

    return {
      users: usersResult,
      total: totalResult[0]?.count || 0,
    };
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async updateUserLastAccess(id: number, ip?: string): Promise<void> {
    const updateData: { ultimoAcceso: Date; direccionIp?: string } = {
      ultimoAcceso: new Date()
    };
    if (ip) {
      updateData.direccionIp = ip;
    }
    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id));
  }

  async getSolicitudes(filters?: {
    operador?: string;
    estado?: string;
    tipoExperticia?: string;
    search?: string;
    coordinacionSolicitante?: string;
    page?: number;
    limit?: number;
  }): Promise<{ solicitudes: Solicitud[]; total: number }> {
    try {
      const page = Math.max(1, filters?.page || 1);
      const limit = Math.min(100, Math.max(1, filters?.limit || 10)); // Limit max page size
      const offset = (page - 1) * limit;

      let whereConditions: any[] = [];

      if (filters?.operador && filters.operador.trim()) {
        whereConditions.push(eq(solicitudes.operador, filters.operador as any));
      }

      if (filters?.estado && filters.estado.trim()) {
        whereConditions.push(eq(solicitudes.estado, filters.estado as any));
      }

      if (filters?.tipoExperticia && filters.tipoExperticia.trim()) {
        whereConditions.push(eq(solicitudes.tipoExperticia, filters.tipoExperticia as any));
      }

      if (filters?.coordinacionSolicitante && filters.coordinacionSolicitante.trim()) {
        whereConditions.push(eq(solicitudes.coordinacionSolicitante, filters.coordinacionSolicitante as any));
      }

      if (filters?.search && filters.search.trim()) {
        const searchTerm = `%${filters.search.trim()}%`;
        whereConditions.push(
          or(
            like(solicitudes.numeroSolicitud, searchTerm),
            like(solicitudes.numeroExpediente, searchTerm),
            like(solicitudes.fiscal, searchTerm)
          )
        );
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [solicitudesResult, totalResult] = await Promise.all([
        db
          .select()
          .from(solicitudes)
          .where(whereClause)
          .orderBy(desc(solicitudes.fechaSolicitud))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(solicitudes)
          .where(whereClause)
      ]);

      return {
        solicitudes: solicitudesResult,
        total: totalResult[0]?.count || 0,
      };
    } catch (error) {
      console.error('Error in getSolicitudes:', error);
      throw error;
    }
  }

  async getSolicitudById(id: number): Promise<Solicitud | undefined> {
    const [solicitud] = await db.select().from(solicitudes).where(eq(solicitudes.id, id));
    return solicitud || undefined;
  }

  async getSolicitudByNumero(numeroSolicitud: string): Promise<Solicitud | undefined> {
    const [solicitud] = await db.select().from(solicitudes).where(eq(solicitudes.numeroSolicitud, numeroSolicitud));
    return solicitud || undefined;
  }

  async createSolicitud(solicitud: InsertSolicitud): Promise<Solicitud> {
    const [newSolicitud] = await db.insert(solicitudes).values(solicitud).returning();
    return newSolicitud;
  }

  async updateSolicitud(id: number, solicitud: Partial<InsertSolicitud>): Promise<Solicitud | undefined> {
    const [updatedSolicitud] = await db
      .update(solicitudes)
      .set({ ...solicitud, updatedAt: new Date() })
      .where(eq(solicitudes.id, id))
      .returning();
    return updatedSolicitud || undefined;
  }

  async deleteSolicitud(id: number): Promise<boolean> {
    try {
      // Use transaction to ensure data consistency
      return await db.transaction(async (tx) => {
        // First delete related notifications
        await tx.delete(notificaciones).where(eq(notificaciones.solicitudId, id));

        // Then delete history records
        await tx.delete(historialSolicitudes).where(eq(historialSolicitudes.solicitudId, id));

        // Finally delete the solicitud
        const result = await tx.delete(solicitudes).where(eq(solicitudes.id, id));
        return (result.rowCount || 0) > 0;
      });
    } catch (error) {
      console.error('Error in deleteSolicitud:', error);
      throw error;
    }
  }

  async getPlantillasCorreo(usuarioId?: number): Promise<PlantillaCorreo[]> {
    const whereClause = usuarioId ? eq(plantillasCorreo.usuarioId, usuarioId) : undefined;
    return await db.select().from(plantillasCorreo).where(whereClause);
  }

  async getPlantillaCorreoById(id: number): Promise<PlantillaCorreo | undefined> {
    const [plantilla] = await db.select().from(plantillasCorreo).where(eq(plantillasCorreo.id, id));
    return plantilla || undefined;
  }

  async createPlantillaCorreo(plantilla: InsertPlantillaCorreo): Promise<PlantillaCorreo> {
    const [newPlantilla] = await db.insert(plantillasCorreo).values(plantilla).returning();
    return newPlantilla;
  }

  async updatePlantillaCorreo(id: number, plantilla: Partial<InsertPlantillaCorreo>): Promise<PlantillaCorreo | undefined> {
    const [updatedPlantilla] = await db
      .update(plantillasCorreo)
      .set({ ...plantilla, updatedAt: new Date() })
      .where(eq(plantillasCorreo.id, id))
      .returning();
    return updatedPlantilla || undefined;
  }

  async deletePlantillaCorreo(id: number): Promise<boolean> {
    const result = await db.delete(plantillasCorreo).where(eq(plantillasCorreo.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createHistorial(historial: InsertHistorialSolicitud): Promise<HistorialSolicitud> {
    const [newHistorial] = await db.insert(historialSolicitudes).values(historial).returning();
    return newHistorial;
  }

  async getHistorialBySolicitud(solicitudId: number): Promise<HistorialSolicitud[]> {
    return await db
      .select()
      .from(historialSolicitudes)
      .where(eq(historialSolicitudes.solicitudId, solicitudId))
      .orderBy(desc(historialSolicitudes.createdAt));
  }

  async getDashboardStats(): Promise<{
    totalSolicitudes: number;
    pendientes: number;
    enviadas: number;
    respondidas: number;
    rechazadas: number;
    solicitudesPorOperador: { operador: string; total: number }[];
    actividadReciente: any[];
  }> {
    // Optimización: Reducir de 7 consultas a 3 consultas
    const [
      estadosStats,
      solicitudesPorOperador,
      actividadReciente,
    ] = await Promise.all([
      // 1. Consulta consolidada para todos los conteos por estado
      db
        .select({
          totalSolicitudes: count(),
          pendientes: count(sql`CASE WHEN ${solicitudes.estado} = 'procesando' THEN 1 END`),
          enviadas: count(sql`CASE WHEN ${solicitudes.estado} = 'enviada' THEN 1 END`),
          respondidas: count(sql`CASE WHEN ${solicitudes.estado} = 'respondida' THEN 1 END`),
          rechazadas: count(sql`CASE WHEN ${solicitudes.estado} = 'rechazada' THEN 1 END`),
        })
        .from(solicitudes),
      // 2. Consulta por operador (ya optimizada)
      db
        .select({
          operador: solicitudes.operador,
          total: count(),
        })
        .from(solicitudes)
        .groupBy(solicitudes.operador),
      // 3. Actividad reciente (ya optimizada)
      db
        .select()
        .from(solicitudes)
        .orderBy(desc(solicitudes.updatedAt))
        .limit(10),
    ]);

    const stats = estadosStats[0];
    return {
      totalSolicitudes: stats.totalSolicitudes,
      pendientes: stats.pendientes,
      enviadas: stats.enviadas,
      respondidas: stats.respondidas,
      rechazadas: stats.rechazadas,
      solicitudesPorOperador: solicitudesPorOperador,
      actividadReciente: actividadReciente,
    };
  }

  async getDashboardStatsByUser(userId: number): Promise<{
    totalSolicitudes: number;
    pendientes: number;
    enviadas: number;
    respondidas: number;
    rechazadas: number;
    solicitudesPorOperador: { operador: string; total: number }[];
    actividadReciente: any[];
  }> {
    // First get the user to find their coordinacion
    const user = await this.getUser(userId);
    // console.log(`[DEBUG] getDashboardStatsByUser - User: ${user?.username}, Coordinacion: ${user?.coordinacion}`); Informacion por log 

    if (!user || !user.coordinacion) {
      //  console.log(`[DEBUG] User not found or no coordinacion - returning empty stats`); Informacion por log 
      // If user doesn't exist or has no coordinacion, return empty stats
      return {
        totalSolicitudes: 0,
        pendientes: 0,
        enviadas: 0,
        respondidas: 0,
        rechazadas: 0,
        solicitudesPorOperador: [],
        actividadReciente: [],
      };
    }

    // Optimización: Filtro por coordinación - Reducir de 7 consultas a 3 consultas
    const [
      estadosStats,
      solicitudesPorOperador,
      actividadReciente,
    ] = await Promise.all([
      // 1. Consulta consolidada para todos los conteos por estado (filtrada por coordinación)
      db
        .select({
          totalSolicitudes: count(),
          pendientes: count(sql`CASE WHEN ${solicitudes.estado} = 'procesando' THEN 1 END`),
          enviadas: count(sql`CASE WHEN ${solicitudes.estado} = 'enviada' THEN 1 END`),
          respondidas: count(sql`CASE WHEN ${solicitudes.estado} = 'respondida' THEN 1 END`),
          rechazadas: count(sql`CASE WHEN ${solicitudes.estado} = 'rechazada' THEN 1 END`),
        })
        .from(solicitudes)
        .where(eq(solicitudes.coordinacionSolicitante, user.coordinacion)),
      // 2. Consulta por operador filtrada por coordinación
      db
        .select({
          operador: solicitudes.operador,
          total: count(),
        })
        .from(solicitudes)
        .where(eq(solicitudes.coordinacionSolicitante, user.coordinacion))
        .groupBy(solicitudes.operador),
      // 3. Actividad reciente filtrada por coordinación
      db
        .select()
        .from(solicitudes)
        .where(eq(solicitudes.coordinacionSolicitante, user.coordinacion))
        .orderBy(desc(solicitudes.updatedAt))
        .limit(10),
    ]);

    const stats = estadosStats[0];
    return {
      totalSolicitudes: stats.totalSolicitudes,
      pendientes: stats.pendientes,
      enviadas: stats.enviadas,
      respondidas: stats.respondidas,
      rechazadas: stats.rechazadas,
      solicitudesPorOperador: solicitudesPorOperador,
      actividadReciente: actividadReciente,
    };
  }



  async getSolicitudesByUser(userId: number, filters?: {
    operador?: string;
    estado?: string;
    tipoExperticia?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ solicitudes: Solicitud[]; total: number }> {
    try {
      // Get user to find their coordinacion
      const user = await this.getUser(userId);
      if (!user || !user.coordinacion) {
        return { solicitudes: [], total: 0 };
      }

      const page = Math.max(1, filters?.page || 1);
      const limit = Math.min(100, Math.max(1, filters?.limit || 10));
      const offset = (page - 1) * limit;

      // Filter by coordinacion instead of just userId
      let whereConditions: any[] = [eq(solicitudes.coordinacionSolicitante, user.coordinacion)];

      if (filters?.operador && filters.operador.trim()) {
        whereConditions.push(eq(solicitudes.operador, filters.operador as any));
      }

      if (filters?.estado && filters.estado.trim()) {
        whereConditions.push(eq(solicitudes.estado, filters.estado as any));
      }

      if (filters?.tipoExperticia && filters.tipoExperticia.trim()) {
        whereConditions.push(eq(solicitudes.tipoExperticia, filters.tipoExperticia as any));
      }

      if (filters?.search && filters.search.trim()) {
        const searchTerm = `%${filters.search.trim()}%`;
        whereConditions.push(
          or(
            like(solicitudes.numeroSolicitud, searchTerm),
            like(solicitudes.numeroExpediente, searchTerm),
            like(solicitudes.fiscal, searchTerm)
          )
        );
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [solicitudesResult, totalResult] = await Promise.all([
        db
          .select()
          .from(solicitudes)
          .where(whereClause)
          .orderBy(desc(solicitudes.fechaSolicitud))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(solicitudes)
          .where(whereClause)
      ]);

      return {
        solicitudes: solicitudesResult,
        total: totalResult[0]?.count || 0,
      };
    } catch (error) {
      console.error('Error in getSolicitudesByUser:', error);
      throw error;
    }
  }



  // Notificaciones
  async createNotificacion(userId: number, solicitudId: number | null, mensaje: string): Promise<void> {
    await db.insert(notificaciones).values({
      usuarioId: userId,
      solicitudId: solicitudId,
      mensaje: mensaje,
      leida: false,
    });
  }

  async getNotificacionesByUser(userId: number): Promise<any[]> {
    const result = await db
      .select({
        id: notificaciones.id,
        mensaje: notificaciones.mensaje,
        leida: notificaciones.leida,
        createdAt: notificaciones.createdAt,
        solicitudId: notificaciones.solicitudId,
        numeroSolicitud: solicitudes.numeroSolicitud,
        estado: solicitudes.estado,
      })
      .from(notificaciones)
      .leftJoin(solicitudes, eq(notificaciones.solicitudId, solicitudes.id))
      .where(eq(notificaciones.usuarioId, userId))
      .orderBy(desc(notificaciones.createdAt));

    return result;
  }

  async markNotificacionAsRead(notificationId: number): Promise<void> {
    await db
      .update(notificaciones)
      .set({ leida: true })
      .where(eq(notificaciones.id, notificationId));
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(notificaciones)
      .where(and(eq(notificaciones.usuarioId, userId), eq(notificaciones.leida, false)));

    return result[0]?.count || 0;
  }

  // Cleanup old notifications
  async cleanupOldNotifications(): Promise<void> {
    try {
      const now = new Date();

      // Get admin user IDs first to optimize the queries
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.rol, 'admin'));

      const adminIds = adminUsers.map(user => user.id);

      // For admin users: delete notifications older than 120 hours (5 days)
      const adminTimeLimit = new Date(now.getTime() - (120 * 60 * 60 * 1000));
      if (adminIds.length > 0) {
        const adminDeleted = await db
          .delete(notificaciones)
          .where(
            and(
              lt(notificaciones.createdAt, adminTimeLimit),
              inArray(notificaciones.usuarioId, adminIds)
            )
          );
        console.log(`Deleted ${adminDeleted.rowCount || 0} old admin notifications`);
      }

      // For non-admin users: delete notifications older than 48 hours
      const userTimeLimit = new Date(now.getTime() - (48 * 60 * 60 * 1000));
      const userDeleted = await db
        .delete(notificaciones)
        .where(
          and(
            lt(notificaciones.createdAt, userTimeLimit),
            ...(adminIds.length > 0 ? [notInArray(notificaciones.usuarioId, adminIds)] : [])
          )
        );
      console.log(`Deleted ${userDeleted.rowCount || 0} old user notifications`);
    } catch (error) {
      console.error('Error in cleanupOldNotifications:', error);
      throw error;
    }
  }

  // Failed login attempts and suspension management
  async incrementFailedAttempts(username: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          intentosFallidos: sql`${users.intentosFallidos} + 1`,
          ultimoIntentoFallido: new Date()
        })
        .where(eq(users.username, username));
    } catch (error) {
      console.error('Error in incrementFailedAttempts:', error);
      throw error;
    }
  }

  async resetFailedAttempts(username: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          intentosFallidos: 0,
          ultimoIntentoFallido: null
        })
        .where(eq(users.username, username));
    } catch (error) {
      console.error('Error in resetFailedAttempts:', error);
      throw error;
    }
  }

  async checkAndSuspendUser(username: string): Promise<boolean> {
    try {
      const user = await this.getUserByUsername(username);
      if (!user) return false;

      if ((user.intentosFallidos ?? 0) >= 2) { // 3 attempts total (0, 1, 2 = 3 attempts)
        const suspensionEnd = new Date();
        suspensionEnd.setHours(suspensionEnd.getHours() + 3); // 3 horas de suspensión

        await db
          .update(users)
          .set({
            status: 'suspendido',
            fechaSuspension: new Date(),
            tiempoSuspension: suspensionEnd,
            motivoSuspension: 'Múltiples intentos fallidos de acceso (3 intentos)',
            intentosFallidos: 0
          })
          .where(eq(users.username, username));

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error in checkAndSuspendUser:', error);
      throw error;
    }
  }

  async checkSuspensionExpired(userId: number): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user) return false;

      if (user.status === 'suspendido' && user.tiempoSuspension) {
        const now = new Date();
        if (now >= user.tiempoSuspension) {
          // Levantar suspensión
          await db
            .update(users)
            .set({
              status: 'activo',
              fechaSuspension: null,
              tiempoSuspension: null,
              motivoSuspension: null
            })
            .where(eq(users.id, userId));

          // Notificar al usuario que se levantó la suspensión
          await this.notifyUserSuspensionLifted(userId);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error in checkSuspensionExpired:', error);
      throw error;
    }
  }

  // Enhanced notification methods
  async notifyAdminsOfSentRequest(solicitudId: number, numeroSolicitud: string): Promise<void> {
    // Get all admin users
    const admins = await db
      .select()
      .from(users)
      .where(eq(users.rol, 'admin'));

    // Send notification to each admin
    for (const admin of admins) {
      await this.createNotificacion(
        admin.id,
        solicitudId,
        `Nueva solicitud enviada: ${numeroSolicitud} ha sido enviada al operador`
      );
    }
  }

  async notifyUserSuspensionLifted(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    // Notify the user
    await this.createNotificacion(
      userId,
      null, // No solicitud asociada
      `Tu cuenta ha sido reactivada. La suspensión temporal ha sido levantada.`
    );

    // Notify admins
    const admins = await db
      .select()
      .from(users)
      .where(eq(users.rol, 'admin'));

    for (const admin of admins) {
      await this.createNotificacion(
        admin.id,
        null,
        `Suspensión levantada: La cuenta de ${user.nombre} (${user.username}) ha sido reactivada automáticamente`
      );
    }
  }

  async notifyAdminsOfFailedLoginSuspension(username: string, ip: string): Promise<void> {
    const user = await this.getUserByUsername(username);
    if (!user) return;

    // Notify all admins about the suspension
    const admins = await db
      .select()
      .from(users)
      .where(eq(users.rol, 'admin'));

    for (const admin of admins) {
      await this.createNotificacion(
        admin.id,
        null,
        `Cuenta suspendida por seguridad: ${user.nombre} (${username}) desde IP ${ip} por múltiples intentos fallidos`
      );
    }
  }
  // Session management methods
  async setUserSession(userId: number, sessionToken: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        sessionToken: sessionToken,
        sessionExpires: expiresAt
      })
      .where(eq(users.id, userId));
  }

  async clearUserSession(userId: number): Promise<void> {
    await db
      .update(users)
      .set({
        sessionToken: null,
        sessionExpires: null
      })
      .where(eq(users.id, userId));
  }

  async getUserBySessionToken(sessionToken: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.sessionToken, sessionToken));
    return user || undefined;
  }

  async isSessionActive(userId: number): Promise<boolean> {
    const [user] = await db
      .select({ sessionToken: users.sessionToken, sessionExpires: users.sessionExpires })
      .from(users)
      .where(eq(users.id, userId));

    if (!user || !user.sessionToken || !user.sessionExpires) {
      return false;
    }

    const now = new Date();
    return now < user.sessionExpires;
  }

  // Plantillas Word methods
  async getPlantillasWord(tipoExperticia?: string): Promise<PlantillaWord[]> {
    if (tipoExperticia) {
      return await db.select().from(plantillasWord).where(eq(plantillasWord.tipoExperticia, tipoExperticia as any));
    }

    return await db.select().from(plantillasWord);
  }

  async getPlantillaWordById(id: number): Promise<PlantillaWord | undefined> {
    const [plantilla] = await db
      .select()
      .from(plantillasWord)
      .where(eq(plantillasWord.id, id));
    return plantilla || undefined;
  }

  async getPlantillaWordByTipoExperticia(tipoExperticia: string): Promise<PlantillaWord | undefined> {
    const [plantilla] = await db
      .select()
      .from(plantillasWord)
      .where(eq(plantillasWord.tipoExperticia, tipoExperticia as any));
    return plantilla || undefined;
  }

  async getPlantillaWordByTipoExperticiaTipoPlantilla(tipoExperticia: string, tipoPlantilla: string): Promise<PlantillaWord | undefined> {
    const [plantilla] = await db
      .select()
      .from(plantillasWord)
      .where(and(
        eq(plantillasWord.tipoExperticia, tipoExperticia as any),
        eq(plantillasWord.tipoPlantilla, tipoPlantilla as any)
      ));
    return plantilla || undefined;
  }

  async createPlantillaWord(plantilla: InsertPlantillaWord): Promise<PlantillaWord> {
    const [newPlantilla] = await db
      .insert(plantillasWord)
      .values(plantilla)
      .returning();
    return newPlantilla;
  }

  async updatePlantillaWord(id: number, plantilla: Partial<InsertPlantillaWord>): Promise<PlantillaWord | undefined> {
    const [updatedPlantilla] = await db
      .update(plantillasWord)
      .set({ ...plantilla, updatedAt: new Date() })
      .where(eq(plantillasWord.id, id))
      .returning();
    return updatedPlantilla || undefined;
  }

  async deletePlantillaWord(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(plantillasWord)
        .where(eq(plantillasWord.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting plantilla word:', error);
      return false;
    }
  }

  // Chatbot management methods
  async getChatbotConfig(clave: string): Promise<ConfiguracionSistema | undefined> {
    const [config] = await db
      .select()
      .from(configuracionSistema)
      .where(eq(configuracionSistema.clave, clave));
    return config || undefined;
  }

  async setChatbotConfig(clave: string, valor: string, usuarioId: number, descripcion?: string): Promise<void> {
    const existingConfig = await this.getChatbotConfig(clave);

    if (existingConfig) {
      await db
        .update(configuracionSistema)
        .set({
          valor,
          usuarioId,
          descripcion: descripcion || existingConfig.descripcion,
          updatedAt: new Date()
        })
        .where(eq(configuracionSistema.clave, clave));
    } else {
      await db.insert(configuracionSistema).values({
        clave,
        valor,
        usuarioId,
        descripcion
      });
    }
  }

  async getUserChatbotStatus(userId: number): Promise<{ habilitado: boolean; mensajesUsados: number; limite: number }> {
    const [user] = await db
      .select({
        chatbotHabilitado: users.chatbotHabilitado,
        chatbotMensajesUsados: users.chatbotMensajesUsados,
        chatbotLimiteMensajes: users.chatbotLimiteMensajes,
        rol: users.rol
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { habilitado: false, mensajesUsados: 0, limite: 0 };
    }

    // Set default limits based on role if not set
    let defaultLimit = 20; // usuario
    if (user.rol === 'supervisor') defaultLimit = 30;
    if (user.rol === 'admin') defaultLimit = 999999; // unlimited for admins

    return {
      habilitado: user.chatbotHabilitado ?? true,
      mensajesUsados: user.chatbotMensajesUsados ?? 0,
      limite: user.chatbotLimiteMensajes ?? defaultLimit
    };
  }

  async updateUserChatbotLimits(userId: number, limite: number, habilitado: boolean): Promise<void> {
    await db
      .update(users)
      .set({
        chatbotLimiteMensajes: limite,
        chatbotHabilitado: habilitado
      })
      .where(eq(users.id, userId));
  }

  async incrementUserChatbotMessages(userId: number): Promise<boolean> {
    const status = await this.getUserChatbotStatus(userId);

    // Get user role to check if admin
    const [user] = await db
      .select({ rol: users.rol })
      .from(users)
      .where(eq(users.id, userId));

    // Admins have unlimited access, no need to check limits or increment
    if (user?.rol === 'admin') {
      return true;
    }

    if (!status.habilitado || status.mensajesUsados >= status.limite) {
      return false;
    }

    await db
      .update(users)
      .set({
        chatbotMensajesUsados: status.mensajesUsados + 1
      })
      .where(eq(users.id, userId));

    return true;
  }

  async resetUserChatbotMessages(userId: number): Promise<void> {
    await db
      .update(users)
      .set({
        chatbotMensajesUsados: 0,
        chatbotReseteoMensajes: new Date()
      })
      .where(eq(users.id, userId));
  }

  async saveChatbotMessage(
    usuarioId: number,
    mensaje: string,
    respuesta: string,
    tieneArchivo?: boolean,
    nombreArchivo?: string
  ): Promise<void> {
    await db.insert(chatbotMensajes).values({
      usuarioId,
      mensaje,
      respuesta,
      tieneArchivo: tieneArchivo || false,
      nombreArchivo
    });
  }

  async getChatbotMessagesByUser(userId: number, limit: number = 50): Promise<ChatbotMensaje[]> {
    return await db
      .select()
      .from(chatbotMensajes)
      .where(eq(chatbotMensajes.usuarioId, userId))
      .orderBy(desc(chatbotMensajes.createdAt))
      .limit(limit);
  }

  async getUsersWithChatbotStats(): Promise<{ usuario: User; mensajesUsados: number; limite: number; habilitado: boolean }[]> {
    const usersWithStats = await db
      .select({
        id: users.id,
        username: users.username,
        nombre: users.nombre,
        email: users.email,
        rol: users.rol,
        coordinacion: users.coordinacion,
        activo: users.activo,
        status: users.status,
        direccionIp: users.direccionIp,
        ultimoAcceso: users.ultimoAcceso,
        createdAt: users.createdAt,
        fechaSuspension: users.fechaSuspension,
        tiempoSuspension: users.tiempoSuspension,
        motivoSuspension: users.motivoSuspension,
        intentosFallidos: users.intentosFallidos,
        ultimoIntentoFallido: users.ultimoIntentoFallido,
        sessionToken: users.sessionToken,
        sessionExpires: users.sessionExpires,
        password: users.password,
        chatbotHabilitado: users.chatbotHabilitado,
        chatbotMensajesUsados: users.chatbotMensajesUsados,
        chatbotLimiteMensajes: users.chatbotLimiteMensajes,
        chatbotReseteoMensajes: users.chatbotReseteoMensajes
      })
      .from(users)
      .where(and(eq(users.activo, true), ne(users.rol, 'admin'))) // Exclude admin users
      .orderBy(users.nombre);

    return usersWithStats.map(user => {
      // Set default limits based on role if not set
      let defaultLimit = 20; // usuario
      if (user.rol === 'supervisor') defaultLimit = 30;
      if (user.rol === 'admin') defaultLimit = 999999; // unlimited for admins

      return {
        usuario: user as User,
        mensajesUsados: user.chatbotMensajesUsados ?? 0,
        limite: user.chatbotLimiteMensajes ?? defaultLimit,
        habilitado: user.chatbotHabilitado ?? true
      };
    });
  }

  async bulkUpdateChatbotLimits(updates: { userId: number; limite: number; habilitado: boolean }[]): Promise<void> {
    for (const update of updates) {
      await this.updateUserChatbotLimits(update.userId, update.limite, update.habilitado);
    }
  }

  // Experticias implementation
  async getExperticias(filters?: {
    operador?: string;
    estado?: string;
    tipoExperticia?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ experticias: Experticia[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    let whereConditions: any[] = [];

    if (filters?.operador) {
      whereConditions.push(eq(experticias.operador, filters.operador as any));
    }

    if (filters?.estado) {
      whereConditions.push(eq(experticias.estado, filters.estado as any));
    }

    if (filters?.tipoExperticia) {
      whereConditions.push(eq(experticias.tipoExperticia, filters.tipoExperticia));
    }

    if (filters?.search) {
      whereConditions.push(
        or(
          like(experticias.numeroDictamen, `%${filters.search}%`),
          like(experticias.expediente, `%${filters.search}%`)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [experticiasResult, totalResult] = await Promise.all([
      db
        .select()
        .from(experticias)
        .where(whereClause)
        .orderBy(desc(experticias.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(experticias)
        .where(whereClause)
    ]);

    return {
      experticias: experticiasResult,
      total: totalResult[0]?.count || 0,
    };
  }

  async getExperticia(id: number): Promise<Experticia | undefined> {
    const [experticia] = await db.select().from(experticias).where(eq(experticias.id, id));
    return experticia || undefined;
  }

  async createExperticia(insertExperticia: InsertExperticia): Promise<Experticia> {
    const [experticia] = await db.insert(experticias).values(insertExperticia).returning();
    return experticia;
  }

  async updateExperticia(id: number, updateData: Partial<InsertExperticia>): Promise<Experticia | undefined> {
    const [experticia] = await db
      .update(experticias)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(experticias.id, id))
      .returning();
    return experticia || undefined;
  }

  async deleteExperticia(id: number): Promise<boolean> {
    const result = await db.delete(experticias).where(eq(experticias.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getExperticiasStats(): Promise<{ total: number; completadas: number; procesando: number; negativas: number; qr_ausente: number }> {
    const rows = await db
      .select({ estado: experticias.estado, cantidad: count() })
      .from(experticias)
      .groupBy(experticias.estado);

    const stats = { total: 0, completadas: 0, procesando: 0, negativas: 0, qr_ausente: 0 };
    for (const row of rows) {
      const n = Number(row.cantidad);
      stats.total += n;
      if (row.estado === 'completada') stats.completadas = n;
      else if (row.estado === 'procesando') stats.procesando = n;
      else if (row.estado === 'negativa') stats.negativas = n;
      else if (row.estado === 'qr_ausente') stats.qr_ausente = n;
    }
    return stats;
  }

  // ============================================
  // ANÁLISIS DE TRAZABILIDAD - Implementaciones
  // ============================================

  // Personas Casos
  async getPersonasCasos(filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ personasCasos: PersonaCaso[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    let whereConditions: any[] = [];

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      whereConditions.push(
        or(
          like(personasCasos.telefono, searchTerm),
          like(personasCasos.cedula, searchTerm),
          like(personasCasos.nombre, searchTerm),
          like(personasCasos.apellido, searchTerm),
          like(personasCasos.expediente, searchTerm)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [personasResult, totalResult] = await Promise.all([
      db
        .select()
        .from(personasCasos)
        .where(whereClause)
        .orderBy(desc(personasCasos.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(personasCasos)
        .where(whereClause)
    ]);

    return {
      personasCasos: personasResult,
      total: totalResult[0]?.count || 0,
    };
  }

  async getPersonaCasoById(nro: number): Promise<PersonaCaso | undefined> {
    const [persona] = await db.select().from(personasCasos).where(eq(personasCasos.nro, nro));
    return persona || undefined;
  }

  async getPersonaCasoByTelefono(telefono: string): Promise<PersonaCaso | undefined> {
    const [exp] = await db.select().from(expedientesSujetos).where(eq(expedientesSujetos.telefonoCaso, telefono));
    if (!exp?.personaId) return undefined;
    const [persona] = await db.select().from(personasCasos).where(eq(personasCasos.nro, exp.personaId));
    return persona || undefined;
  }

  async findPersonaByCedula(cedula: string): Promise<PersonaCaso | undefined> {
    const [persona] = await db.select().from(personasCasos).where(eq(personasCasos.cedula, cedula));
    return persona || undefined;
  }

  async createPersonaCaso(personaCaso: InsertPersonaCaso): Promise<PersonaCaso> {
    const [newPersona] = await db.insert(personasCasos).values(personaCaso).returning();
    return newPersona;
  }

  async updatePersonaCaso(nro: number, personaCaso: Partial<InsertPersonaCaso>): Promise<PersonaCaso | undefined> {
    const [updatedPersona] = await db
      .update(personasCasos)
      .set({ ...personaCaso, updatedAt: new Date() })
      .where(eq(personasCasos.nro, nro))
      .returning();
    return updatedPersona || undefined;
  }

  async deletePersonaCaso(nro: number): Promise<boolean> {
    // CASCADE eliminará automáticamente los teléfonos asociados de persona_telefonos
    // Los registros de comunicación mantendrán sus strings pero perderán las FKs
    const result = await db.delete(personasCasos).where(eq(personasCasos.nro, nro));
    return (result.rowCount || 0) > 0;
  }

  async upsertPersonaCasoByAbonado(abonado: string, data: Partial<InsertPersonaCaso>): Promise<PersonaCaso> {
    // Buscar persona existente por cédula (si se provee) o por teléfono en expedientesSujetos
    let persona: PersonaCaso | undefined;

    if (data.cedula) {
      const [byCedula] = await db.select().from(personasCasos).where(eq(personasCasos.cedula, data.cedula));
      persona = byCedula;
    }

    if (!persona) {
      const [expRow] = await db.select().from(expedientesSujetos).where(eq(expedientesSujetos.telefonoCaso, abonado));
      if (expRow?.personaId) {
        const [byPhone] = await db.select().from(personasCasos).where(eq(personasCasos.nro, expRow.personaId));
        persona = byPhone;
      }
    }

    const { ...bioData } = data;

    if (persona) {
      const [updated] = await db
        .update(personasCasos)
        .set({ ...bioData, updatedAt: new Date() })
        .where(eq(personasCasos.nro, persona.nro))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(personasCasos)
        .values(bioData as InsertPersonaCaso)
        .returning();
      // Crear expediente mínimo con el teléfono del caso
      await db.insert(expedientesSujetos).values({ personaId: created.nro, telefonoCaso: abonado });
      return created;
    }
  }

  // Expedientes Sujetos
  async createExpedienteSujeto(data: InsertExpedienteSujeto): Promise<ExpedienteSujeto> {
    const [row] = await db.insert(expedientesSujetos).values(data).returning();
    return row;
  }

  async getExpedientesSujetosByPersonaId(personaId: number): Promise<ExpedienteSujeto[]> {
    return await db.select().from(expedientesSujetos).where(eq(expedientesSujetos.personaId, personaId));
  }

  async getExpedienteSujetoById(id: number): Promise<ExpedienteSujeto | undefined> {
    const [row] = await db.select().from(expedientesSujetos).where(eq(expedientesSujetos.id, id));
    return row || undefined;
  }

  async updateExpedienteSujeto(id: number, data: Partial<InsertExpedienteSujeto>): Promise<ExpedienteSujeto | undefined> {
    const [updated] = await db
      .update(expedientesSujetos)
      .set(data)
      .where(eq(expedientesSujetos.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExpedienteSujeto(id: number): Promise<boolean> {
    const result = await db.delete(expedientesSujetos).where(eq(expedientesSujetos.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Registros Comunicación
  async getRegistrosComunicacion(filters?: {
    abonadoA?: string;
    abonadoB?: string;
    fecha?: string;
    page?: number;
    limit?: number;
  }): Promise<{ registros: RegistroComunicacion[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    let whereConditions: any[] = [];

    if (filters?.abonadoA) {
      whereConditions.push(eq(registrosComunicacion.abonadoA, filters.abonadoA));
    }

    if (filters?.abonadoB) {
      whereConditions.push(like(registrosComunicacion.abonadoB, `%${filters.abonadoB}%`));
    }

    if (filters?.fecha) {
      whereConditions.push(eq(registrosComunicacion.fecha, filters.fecha));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [registrosResult, totalResult] = await Promise.all([
      db
        .select()
        .from(registrosComunicacion)
        .where(whereClause)
        .orderBy(desc(registrosComunicacion.fecha))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(registrosComunicacion)
        .where(whereClause)
    ]);

    return {
      registros: registrosResult,
      total: totalResult[0]?.count || 0,
    };
  }

  async getRegistroComunicacionById(registroId: number): Promise<RegistroComunicacion | undefined> {
    const [registro] = await db.select().from(registrosComunicacion).where(eq(registrosComunicacion.registroId, registroId));
    return registro || undefined;
  }

  async getRegistrosComunicacionByAbonado(abonado: string): Promise<RegistroComunicacion[]> {
    // La forma correcta: filtrar por abonado_a_id (FK hacia persona_telefonos).
    // Esta FK solo se asigna al número que fue el sujeto analizado en cada fila,
    // garantizando exactamente sus registros sin contaminación cruzada.
    const [telRecord] = await db
      .select({ id: personaTelefonos.id })
      .from(personaTelefonos)
      .where(eq(personaTelefonos.numero, abonado));

    if (!telRecord) return [];

    return await db
      .select()
      .from(registrosComunicacion)
      .where(eq(registrosComunicacion.abonadoAId, telRecord.id))
      .orderBy(desc(registrosComunicacion.fecha));
  }

  async getRegistrosComunicacionByTelefonoIds(telefonoIds: number[]): Promise<RegistroComunicacion[]> {
    if (telefonoIds.length === 0) return [];

    // Buscar registros donde abonadoAId o abonadoBId estén en la lista de IDs
    return await db
      .select()
      .from(registrosComunicacion)
      .where(
        or(
          inArray(registrosComunicacion.abonadoAId, telefonoIds),
          inArray(registrosComunicacion.abonadoBId, telefonoIds)
        )
      )
      .orderBy(desc(registrosComunicacion.fecha));
  }

  async createRegistroComunicacion(registro: InsertRegistroComunicacion): Promise<RegistroComunicacion> {
    const [newRegistro] = await db.insert(registrosComunicacion).values(registro).returning();
    return newRegistro;
  }

  async createRegistrosComunicacionBulk(registros: InsertRegistroComunicacion[]): Promise<void> {
    if (registros.length === 0) return;
    const CHUNK = 500;
    for (let i = 0; i < registros.length; i += CHUNK) {
      await db.insert(registrosComunicacion).values(registros.slice(i, i + CHUNK));
    }
  }

  async updateRegistroComunicacion(registroId: number, registro: Partial<InsertRegistroComunicacion>): Promise<RegistroComunicacion | undefined> {
    const [updatedRegistro] = await db
      .update(registrosComunicacion)
      .set(registro)
      .where(eq(registrosComunicacion.registroId, registroId))
      .returning();
    return updatedRegistro || undefined;
  }

  async deleteRegistroComunicacion(registroId: number): Promise<boolean> {
    const result = await db.delete(registrosComunicacion).where(eq(registrosComunicacion.registroId, registroId));
    return (result.rowCount || 0) > 0;
  }

  // Persona Teléfonos - Catálogo de números
  async getPersonaTelefonos(personaId: number): Promise<PersonaTelefono[]> {
    return await db
      .select()
      .from(personaTelefonos)
      .where(eq(personaTelefonos.personaId, personaId))
      .orderBy(desc(personaTelefonos.activo), desc(personaTelefonos.createdAt));
  }

  async getPersonaTelefonoById(id: number): Promise<PersonaTelefono | undefined> {
    const [telefono] = await db.select().from(personaTelefonos).where(eq(personaTelefonos.id, id));
    return telefono || undefined;
  }

  async getPersonaTelefonoByNumero(numero: string): Promise<PersonaTelefono | undefined> {
    const [telefono] = await db.select().from(personaTelefonos).where(eq(personaTelefonos.numero, numero));
    return telefono || undefined;
  }

  async createPersonaTelefono(telefono: InsertPersonaTelefono): Promise<PersonaTelefono> {
    const [newTelefono] = await db.insert(personaTelefonos).values(telefono).returning();
    return newTelefono;
  }

  async createPersonaTelefonosBulk(telefonos: InsertPersonaTelefono[]): Promise<PersonaTelefono[]> {
    if (telefonos.length === 0) return [];
    const newTelefonos = await db.insert(personaTelefonos).values(telefonos).returning();
    return newTelefonos;
  }

  async updatePersonaTelefono(id: number, telefono: Partial<InsertPersonaTelefono>): Promise<PersonaTelefono | undefined> {
    const [updatedTelefono] = await db
      .update(personaTelefonos)
      .set(telefono)
      .where(eq(personaTelefonos.id, id))
      .returning();
    return updatedTelefono || undefined;
  }

  async deletePersonaTelefono(id: number): Promise<boolean> {
    const result = await db.delete(personaTelefonos).where(eq(personaTelefonos.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deletePersonaTelefonosByPersona(personaId: number): Promise<boolean> {
    const result = await db.delete(personaTelefonos).where(eq(personaTelefonos.personaId, personaId));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
