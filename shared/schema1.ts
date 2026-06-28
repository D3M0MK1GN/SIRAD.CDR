import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const statusEnum = pgEnum("status", ["activo", "suspendido", "bloqueado"]);

export const delegacionEnum = pgEnum("delegacion", [
  "delegacion_municipal_quibor",
  "delegacion_municipal_barquisimeto", 
  "delegacion_municipal_san_juan",
  "delegacion_municipal_tocuyo",
  "delegacion_municipal_cabudare",
  "delegacion_municipal_iribarren",
  "delegacion_municipal_palavecino",
  "delegacion_municipal_crespo",
  "delegacion_municipal_morán",
  "delegacion_municipal_simón_planas",
  "delegacion_municipal_andrés_eloy_blanco",
  "delegacion_municipal_jiménez", 
  "delegacion_municipal_torres",
  "delegacion_municipal_urdaneta",
  "delegacion_municipal_sucre",
  "delegacion_municipal_libertador",
  "delegacion_municipal_chacao",
  "delegacion_municipal_baruta",
  "delegacion_municipal_el_hatillo",
  "delegacion_municipal_maracaibo",
  "delegacion_municipal_san_francisco",
  "delegacion_municipal_cabimas",
  "delegacion_municipal_valencia",
  "delegacion_municipal_naguanagua",
  "delegacion_municipal_girardot",
  "delegacion_municipal_maracay",
  "delegacion_municipal_san_cristóbal",
  "delegacion_municipal_libertador_merida"
]);

// Esquema para la Tabla usuarios de la Base de datos
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  nombre: text("nombre").notNull(),
  email: text("email"),
  credencial: text("credencial"),
  numeroTelefonico: text("numero_telefonico"),
  rol: text("rol").default("usuario"),
  coordinacion: text("coordinacion"),
  delegacion: delegacionEnum("delegacion"),
  activo: boolean("activo").default(true),
  status: statusEnum("status").default("activo"),
  direccionIp: text("direccion_ip"),
  ultimoAcceso: timestamp("ultimo_acceso"),
  createdAt: timestamp("created_at").defaultNow(),
  fechaSuspension: timestamp("fecha_suspension"),
  tiempoSuspension: timestamp("tiempo_suspension"),
  motivoSuspension: text("motivo_suspension"),
  intentosFallidos: integer("intentos_fallidos").default(0),
  ultimoIntentoFallido: timestamp("ultimo_intento_fallido"),
  sessionToken: text("session_token"), // Para gestión de sesiones únicas
  sessionExpires: timestamp("session_expires"), // Expiración
  // 
  //  de sesión
  // Campos para control del chatbot
  chatbotHabilitado: boolean("chatbot_habilitado").default(true),
  chatbotLimiteMensajes: integer("chatbot_limite_mensajes").default(20),
  chatbotMensajesUsados: integer("chatbot_mensajes_usados").default(0),
  chatbotReseteoMensajes: timestamp("chatbot_reseteo_mensajes").defaultNow(),
});

export const operadorEnum = pgEnum("operador", ["digitel", "movistar", "movilnet"]);
export const estadoEnum = pgEnum("estado", ["procesando", "enviada", "respondida", "rechazada"]);
export const estadoExperticiasEnum = pgEnum("estado_experticias", ["completada", "negativa", "procesando", "qr_ausente"]);
export const tipoPlantillaWordEnum = pgEnum("tipo_plantilla_word", ["solicitud", "experticia"]);


export const solicitudes = pgTable("solicitudes", {
  id: serial("id").primaryKey(),
  numeroSolicitud: text("numero_solicitud").notNull().unique(),
  numeroExpediente: text("numero_expediente").notNull(),
  fiscal: text("fiscal"),
  tipoExperticia: text("tipo_experticia").notNull(),
  coordinacionSolicitante: text("coordinacion_solicitante").notNull(),
  operador: operadorEnum("operador").notNull(),
  informacionLinea: text("informacion_linea"), // Linea de Codigo Redundante
  direc: text("direc"),
  delito: text("delito"),
  fecha_de_solicitud: text("fecha_de_solicitud"), // Timpo de requerir la informacion   
  descripcion: text("descripcion"),
  motivoRechazo: text("motivo_rechazo"),
  estado: estadoEnum("estado").default("enviada"),
  fechaSolicitud: timestamp("fecha_solicitud").defaultNow(),
  fechaRespuesta: timestamp("fecha_respuesta"),
  oficio: text("oficio"),
  usuarioId: integer("usuario_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const plantillasCorreo = pgTable("plantillas_correo", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  operador: operadorEnum("operador").notNull(),
  asunto: text("asunto").notNull(),
  cuerpo: text("cuerpo").notNull(),
  usuarioId: integer("usuario_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const historialSolicitudes = pgTable("historial_solicitudes", {
  id: serial("id").primaryKey(),
  solicitudId: integer("solicitud_id").references(() => solicitudes.id),
  accion: text("accion").notNull(),
  descripcion: text("descripcion"),
  usuarioId: integer("usuario_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificaciones = pgTable("notificaciones", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => users.id),
  solicitudId: integer("solicitud_id").references(() => solicitudes.id),
  mensaje: text("mensaje").notNull(),
  leida: boolean("leida").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const plantillasWord = pgTable("plantillas_word", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  tipoExperticia: text("tipo_experticia").notNull(),
  tipoPlantilla: tipoPlantillaWordEnum("tipo_plantilla").default("solicitud"),
  archivo: text("archivo").notNull(), // Ruta del archivo o contenido base64
  nombreArchivo: text("nombre_archivo").notNull(), // Nombre original del archivo
  tamaño: integer("tamaño"), // Tamaño en bytes
  usuarioId: integer("usuario_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabla para configuración global del sistema
export const configuracionSistema = pgTable("configuracion_sistema", {
  id: serial("id").primaryKey(),
  clave: text("clave").notNull().unique(),
  valor: text("valor").notNull(),
  descripcion: text("descripcion"),
  usuarioId: integer("usuario_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabla para historial de mensajes del chatbot
export const chatbotMensajes = pgTable("chatbot_mensajes", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  mensaje: text("mensaje").notNull(),
  respuesta: text("respuesta").notNull(),
  tieneArchivo: boolean("tiene_archivo").default(false),
  nombreArchivo: text("nombre_archivo"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const configuracionSistemaRelations = relations(configuracionSistema, ({ one }) => ({
  usuario: one(users, {
    fields: [configuracionSistema.usuarioId],
    references: [users.id],
  }),
}));

export const chatbotMensajesRelations = relations(chatbotMensajes, ({ one }) => ({
  usuario: one(users, {
    fields: [chatbotMensajes.usuarioId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  solicitudes: many(solicitudes),
  plantillasCorreo: many(plantillasCorreo),
  historialSolicitudes: many(historialSolicitudes),
  notificaciones: many(notificaciones),
  plantillasWord: many(plantillasWord),
  chatbotMensajes: many(chatbotMensajes),
  configuracionSistema: many(configuracionSistema),

}));

export const solicitudesRelations = relations(solicitudes, ({ one, many }) => ({
  usuario: one(users, {
    fields: [solicitudes.usuarioId],
    references: [users.id],
  }),
  historial: many(historialSolicitudes),
  notificaciones: many(notificaciones),
}));

export const plantillasCorreoRelations = relations(plantillasCorreo, ({ one }) => ({
  usuario: one(users, {
    fields: [plantillasCorreo.usuarioId],
    references: [users.id],
  }),
}));

export const historialSolicitudesRelations = relations(historialSolicitudes, ({ one }) => ({
  solicitud: one(solicitudes, {
    fields: [historialSolicitudes.solicitudId],
    references: [solicitudes.id],
  }),
  usuario: one(users, {
    fields: [historialSolicitudes.usuarioId],
    references: [users.id],
  }),
}));

export const notificacionesRelations = relations(notificaciones, ({ one }) => ({
  usuario: one(users, {
    fields: [notificaciones.usuarioId],
    references: [users.id],
  }),
  solicitud: one(solicitudes, {
    fields: [notificaciones.solicitudId],
    references: [solicitudes.id],
  }),
}));

export const plantillasWordRelations = relations(plantillasWord, ({ one }) => ({
  usuario: one(users, {
    fields: [plantillasWord.usuarioId],
    references: [users.id],
  }),
}));



// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  ultimoAcceso: true,
});

export const insertSolicitudSchema = createInsertSchema(solicitudes).omit({
  id: true,
  fechaSolicitud: true,
  fechaRespuesta: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  numeroSolicitud: z.string()
    .min(1, "Número de solicitud es requerido")
    .max(50, "Número de solicitud muy largo")
    .transform(val => val.trim()),
  numeroExpediente: z.string()
    .min(1, "Número de expediente es requerido")
    .max(50, "Número de expediente muy largo")
    .transform(val => val.trim()),
  fiscal: z.string()
    .min(1, "Fiscal es requerido")
    .max(100, "Nombre del fiscal muy largo")
    .transform(val => val.trim()),
});

export const insertPlantillaCorreoSchema = createInsertSchema(plantillasCorreo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlantillaWordSchema = createInsertSchema(plantillasWord).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHistorialSchema = createInsertSchema(historialSolicitudes).omit({
  id: true,
  createdAt: true,
});

export const insertConfiguracionSistemaSchema = createInsertSchema(configuracionSistema).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tabla de Experticias
export const experticias = pgTable("experticias", {
  id: serial("id").primaryKey(),
  numeroDictamen: text("numero_dictamen").notNull().unique(),
  experto: text("experto").notNull(),
  numeroComunicacion: text("numero_comunicacion").notNull(),
  fechaComunicacion: text("fecha_comunicacion"),
  motivo: text("motivo").notNull(),
  operador: operadorEnum("operador").notNull(),
  fechaRespuesta: text("fecha_respuesta"),
  archivoAdjunto: text("archivo_adjunto"), // Ruta del archivo adjunto
  nombreArchivo: text("nombre_archivo"), // Nombre exacto del archivo
  tamañoArchivo: integer("tamaño_archivo"), // Tamaño en bytes del archivo
  tipoExperticia: text("tipo_experticia").notNull(),
  abonado: text("abonado"),
  datosAbonado: text("datos_abonado"),
  conclusion: text("conclusion"),
  respuestaFechaCorreo: text("respuesta_fecha_correo"),
  horaRespuestaCorreo: text("hora_respuesta_correo"),
  expediente: text("expediente").notNull(),
  estado: estadoExperticiasEnum("estado").default("procesando"),
  datosSeleccionados: jsonb("datos_seleccionados"), // Almacena filas/columnas seleccionadas en formato JSON (DEPRECATED - usar datosAnalisis y datosSeleccionadosTop10)
  datosAnalisis: jsonb("datos_analisis"), // Almacena datos_crudos del análisis (Estructura: ABONADO A, ABONADO B, TIPO TRANSACCION, FECHA, HORA, TIME, BTS-CELDA, DIRECCION_A, DIRECCION_B, CORDENADAS_A, CORDENADAS_B, ORIENTACION A, ORIENTACION B, IMEI ABONADO A, IMEI ABONADO B)
  datosSeleccionadosTop10: jsonb("datos_seleccionados_top10"), // Almacena filas seleccionadas del TOP 10
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  usuarioId: integer("usuario_id").references(() => users.id),
});

export const insertChatbotMensajeSchema = createInsertSchema(chatbotMensajes).omit({
  id: true,
  createdAt: true,
});

export const insertExperticiasSchema = createInsertSchema(experticias).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  numeroDictamen: z.string()
    .min(1, "Número de dictamen es requerido")
    .max(100, "Número de dictamen muy largo")
    .transform(val => val.trim()),
  experto: z.string()
    .min(1, "Experto es requerido")
    .max(200, "Nombre del experto muy largo")
    .transform(val => val.trim()),
  numeroComunicacion: z.string()
    .min(1, "Número de comunicación es requerido")
    .max(100, "Número de comunicación muy largo")
    .transform(val => val.trim()),
  motivo: z.string()
    .min(1, "Motivo es requerido")
    .transform(val => val.trim()),
  tipoExperticia: z.string()
    .min(1, "Tipo de experticia es requerido")
    .transform(val => val.trim()),
  expediente: z.string()
    .min(1, "Expediente es requerido")
    .max(100, "Expediente muy largo")
    .transform(val => val.trim()),
  // Campos nuevos para análisis de contactos frecuentes
  datosAnalisis: z.any().optional(), // Guarda datos_crudos del Excel
  datosSeleccionadosTop10: z.any().optional(), // Guarda filas seleccionadas del TOP 10
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Solicitud = typeof solicitudes.$inferSelect;
export type InsertSolicitud = z.infer<typeof insertSolicitudSchema>;
export type PlantillaCorreo = typeof plantillasCorreo.$inferSelect;
export type InsertPlantillaCorreo = z.infer<typeof insertPlantillaCorreoSchema>;
export type PlantillaWord = typeof plantillasWord.$inferSelect;
export type InsertPlantillaWord = z.infer<typeof insertPlantillaWordSchema>;
export type HistorialSolicitud = typeof historialSolicitudes.$inferSelect;
export type InsertHistorialSolicitud = z.infer<typeof insertHistorialSchema>;
export type ConfiguracionSistema = typeof configuracionSistema.$inferSelect;
export type InsertConfiguracionSistema = z.infer<typeof insertConfiguracionSistemaSchema>;
export type ChatbotMensaje = typeof chatbotMensajes.$inferSelect;
export type InsertChatbotMensaje = z.infer<typeof insertChatbotMensajeSchema>;
export type Experticia = typeof experticias.$inferSelect;
export type InsertExperticia = z.infer<typeof insertExperticiasSchema>;

// Relaciones que deben ir al final
export const experticiasRelations = relations(experticias, ({ one }) => ({
  usuario: one(users, {
    fields: [experticias.usuarioId],
    references: [users.id],
  }),
}));

export const usersRelationsComplete = relations(users, ({ many }) => ({
  solicitudes: many(solicitudes),
  plantillasCorreo: many(plantillasCorreo),
  historialSolicitudes: many(historialSolicitudes),
  notificaciones: many(notificaciones),
  plantillasWord: many(plantillasWord),
  chatbotMensajes: many(chatbotMensajes),
  configuracionSistema: many(configuracionSistema),
  experticias: many(experticias),
}));

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Usuario es requerido"),
  password: z.string().min(1, "Contraseña es requerida"),
});

export type LoginData = z.infer<typeof loginSchema>;

// ============================================
// ANÁLISIS DE TRAZABILIDAD - Nuevas Tablas
// ============================================

// Tabla PERSONA_CASO - Almacena datos estáticos del caso y de la persona
export const personasCasos = pgTable("personas_casos", {
  nro: serial("nro").primaryKey(),
  cedula: text("cedula").unique(),
  nombre: text("nombre"),
  apellido: text("apellido"),
  edad: integer("edad"),
  fechaDeNacimiento: text("fecha_de_nacimiento"),
  profesion: text("profesion"),
  correo: text("correo"),
  direccion: text("direccion"),
  otrosTlf: text("otros_tlf"),
  rol: text("rol"),
  usuarioId: integer("usuario_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabla PERSONA_TELEFONOS - Catálogo de números asociados a personas
export const personaTelefonos = pgTable("persona_telefonos", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").references(() => personasCasos.nro, { onDelete: 'cascade' }),
  numero: text("numero").notNull(), // Número de teléfono (sin UNIQUE: puede repetirse en casos independientes)
  tipo: text("tipo"), // Tipo: móvil, fijo, trabajo, etc.
  iconoTipo: text("icono_tipo"), // Icono asignado para visualización en el grafo
  activo: boolean("activo").default(true),
  statusLinea: text("status_linea"),
  fechaActivacion: text("fecha_activacion"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabla REGISTRO_COMUNICACION - Almacena cada evento de comunicación
export const registrosComunicacion = pgTable("registros_comunicacion", {
  registroId: serial("registro_id").primaryKey(),
  experticiaId: integer("experticia_id").references(() => experticias.id, { onDelete: 'cascade' }),
  abonadoA: text("abonado_a").notNull(),
  abonadoB: text("abonado_b"),
  abonadoAId: integer("abonado_a_id").references(() => personaTelefonos.id),
  abonadoBId: integer("abonado_b_id").references(() => personaTelefonos.id),
  tipoTransaccion: text("tipo_transaccion"),
  fecha: text("fecha"),
  hora: text("hora"),
  time: text("time"),
  btsCeldaA: text("bts_celda_a"),
  btsCeldaB: text("bts_celda_b"),
  direccionA: text("direccion_a"),
  direccionB: text("direccion_b"),
  coordenadasA: text("coordenadas_a"),
  coordenadasB: text("coordenadas_b"),
  orientacionA: text("orientacion_a"),
  orientacionB: text("orientacion_b"),
  imeiA: text("imei_a"),
  imeiB: text("imei_b"),
  archivo: text("archivo"),
  peso: text("peso"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  abonadoAIdx:   index("idx_registros_abonado_a").on(table.abonadoA),
  abonadoBIdx:   index("idx_registros_abonado_b").on(table.abonadoB),
  experticiaIdx: index("idx_registros_experticia").on(table.experticiaId),
}));

// Tabla EXPEDIENTES_SUJETOS - Datos del caso asociados a una persona
export const expedientesSujetos = pgTable("expedientes_sujetos", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").references(() => personasCasos.nro, { onDelete: 'cascade' }),
  telefonoCaso: text("telefono_caso"),
  expediente: text("expediente"),
  pseudonimo: text("pseudonimo"),
  delito: text("delito"),
  fiscalia: text("fiscalia"),
  nOficio: text("n_oficio"),
  fechaDeInicio: text("fecha_de_inicio"),
  descripcion: text("descripcion"),
  observacion: text("observacion"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relaciones
export const personasCasosRelations = relations(personasCasos, ({ one, many }) => ({
  usuario: one(users, {
    fields: [personasCasos.usuarioId],
    references: [users.id],
  }),
  telefonos: many(personaTelefonos),
  expedientes: many(expedientesSujetos),
}));

export const expedientesSujetosRelations = relations(expedientesSujetos, ({ one }) => ({
  persona: one(personasCasos, {
    fields: [expedientesSujetos.personaId],
    references: [personasCasos.nro],
  }),
}));

export const personaTelefonosRelations = relations(personaTelefonos, ({ one, many }) => ({
  persona: one(personasCasos, {
    fields: [personaTelefonos.personaId],
    references: [personasCasos.nro],
  }),
  registrosComunicacionA: many(registrosComunicacion, {
    relationName: 'registros_abonado_a',
  }),
  registrosComunicacionB: many(registrosComunicacion, {
    relationName: 'registros_abonado_b',
  }),
}));

export const registrosComunicacionRelations = relations(registrosComunicacion, ({ one }) => ({
  experticia: one(experticias, {
    fields: [registrosComunicacion.experticiaId],
    references: [experticias.id],
  }),
  telefonoA: one(personaTelefonos, {
    fields: [registrosComunicacion.abonadoAId],
    references: [personaTelefonos.id],
    relationName: 'registros_abonado_a',
  }),
  telefonoB: one(personaTelefonos, {
    fields: [registrosComunicacion.abonadoBId],
    references: [personaTelefonos.id],
    relationName: 'registros_abonado_b',
  }),
}));

// Insert schemas
const optionalText = z.union([z.string(), z.null()])
  .optional()
  .transform(val => {
    if (!val || val === null || (typeof val === 'string' && val.trim() === '')) return undefined;
    return typeof val === 'string' ? val.trim() : undefined;
  });

const nullableText = z.union([z.string(), z.null()])
  .optional()
  .transform(val => {
    if (val === null) return null;
    if (val === undefined) return undefined;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    }
    return undefined;
  });

export const insertPersonaCasoSchema = createInsertSchema(personasCasos).omit({
  nro: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  cedula: nullableText,
  apellido: optionalText,
  fechaDeNacimiento: optionalText,
  profesion: optionalText,
  direccion: optionalText,
});

export const insertExpedienteSujetoSchema = createInsertSchema(expedientesSujetos).omit({
  id: true,
  createdAt: true,
}).extend({
  telefonoCaso: optionalText,
  expediente: nullableText,
  pseudonimo: optionalText,
  delito: optionalText,
  fiscalia: optionalText,
  nOficio: optionalText,
  fechaDeInicio: optionalText,
  descripcion: optionalText,
  observacion: optionalText,
});

export const insertPersonaTelefonoSchema = createInsertSchema(personaTelefonos).omit({
  id: true,
  createdAt: true,
}).extend({
  numero: z.string()
    .min(1, "Número de teléfono es requerido")
    .max(20, "Número muy largo")
    .transform(val => val.trim()),
  tipo: z.string()
    .max(50, "Tipo muy largo")
    .optional(),
});

export const insertRegistroComunicacionSchema = createInsertSchema(registrosComunicacion).omit({
  registroId: true,
  createdAt: true,
}).extend({
  abonadoA: z.string()
    .min(1, "Abonado A es requerido")
    .max(20, "Abonado A muy largo")
    .transform(val => val.trim()),
});

// Types
export type PersonaCaso = typeof personasCasos.$inferSelect;
export type InsertPersonaCaso = z.infer<typeof insertPersonaCasoSchema>;
export type ExpedienteSujeto = typeof expedientesSujetos.$inferSelect;
export type InsertExpedienteSujeto = z.infer<typeof insertExpedienteSujetoSchema>;
export type PersonaTelefono = typeof personaTelefonos.$inferSelect;
export type InsertPersonaTelefono = z.infer<typeof insertPersonaTelefonoSchema>;
export type RegistroComunicacion = typeof registrosComunicacion.$inferSelect;
export type InsertRegistroComunicacion = z.infer<typeof insertRegistroComunicacionSchema>;
