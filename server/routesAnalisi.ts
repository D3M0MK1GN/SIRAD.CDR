// ── Rutas de Análisis de Trazabilidad ──────────────────────────────────────
import type { Express } from "express";
import { storage } from "./storage";
import { db } from "./db";
import {
  personasCasos,
  personaTelefonos,
  experticias,
  expedientesSujetos,
  registrosComunicacion,
} from "@shared/schema";
import { eq, sql, or } from "drizzle-orm";
import {
  insertPersonaCasoSchema,
  insertExpedienteSujetoSchema,
  insertPersonaTelefonoSchema,
  insertRegistroComunicacionSchema,
} from "@shared/schema";
import multer from "multer";
import ExcelJS from "exceljs";

// Multer para importación de análisis desde CSV
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos CSV") as any, false);
    }
  },
});

function normalizarCoordenada(val: string): string {
  if (!val) return "";
  return val.split(",").map((part) => {
    const s = part.trim();
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1) {
      const sign = s.startsWith("-") ? -1 : 1;
      const digits = s.replace(/[^0-9]/g, "");
      const num = parseInt(digits, 10) / 1_000_000;
      return (sign * num).toFixed(6);
    }
    return s;
  }).join(", ");
}

export function registerAnalisisRoutes(
  app: Express,
  authenticateToken: any,
  requireAdmin: any,
  uploadData: any
): void {

  // ── Personas Casos ────────────────────────────────────────────────────────

  app.get("/api/personas-casos", authenticateToken, async (req: any, res) => {
    try {
      const { search, page, limit } = req.query;
      const result = await storage.getPersonasCasos({
        search: search as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener personas casos" });
    }
  });

  // Ruta liviana: actualiza/crea status_linea y fecha_activacion en persona_telefonos por número
  app.post("/api/persona-telefonos/update-by-numero", authenticateToken, async (req: any, res) => {
    try {
      const { numero, statusLinea, fechaActivacion } = req.body;
      if (!numero) return res.status(400).json({ message: "numero es requerido" });

      const telExistente = await storage.getPersonaTelefonoByNumero(numero);
      if (telExistente) {
        const updated = await storage.updatePersonaTelefono(telExistente.id, {
          statusLinea: statusLinea || undefined,
          fechaActivacion: fechaActivacion || undefined,
        });
        return res.json(updated);
      } else {
        const created = await storage.createPersonaTelefono({
          numero,
          statusLinea: statusLinea || undefined,
          fechaActivacion: fechaActivacion || undefined,
        });
        return res.status(201).json(created);
      }
    } catch {
      res.status(500).json({ message: "Error actualizando teléfono" });
    }
  });

  app.post("/api/personas-casos", authenticateToken, async (req: any, res) => {
    try {
      const body = req.body;

      const bioFields = {
        cedula: body.cedula,
        nombre: body.nombre,
        apellido: body.apellido,
        edad: body.edad,
        fechaDeNacimiento: body.fechaDeNacimiento,
        profesion: body.profesion,
        correo: body.correo,
        direccion: body.direccion,
        otrosTlf: body.otrosTlf || null,
        rol: body.rol || null,
        usuarioId: req.user.id,
      };

      const caseFields = {
        telefonoCaso: body.telefono || body.telefonoCaso,
        expediente: body.expediente,
        pseudonimo: body.pseudonimo,
        delito: body.delito,
        fiscalia: body.fiscalia,
        nOficio: body.nOficio,
        fechaDeInicio: body.fechaDeInicio,
        descripcion: body.descripcion,
        observacion: body.observacion,
      };

      const validatedBio = insertPersonaCasoSchema.parse(bioFields);

      let persona = validatedBio.cedula
        ? await storage.findPersonaByCedula(validatedBio.cedula)
        : undefined;

      if (!persona) {
        persona = await storage.createPersonaCaso(validatedBio);
      } else {
        persona = (await storage.updatePersonaCaso(persona.nro, validatedBio)) || persona;
      }

      // Upsert status_linea y fecha_activacion en persona_telefonos si se provee el teléfono
      const telefonoNumero = body.telefono || body.telefonoCaso;
      if (telefonoNumero && (body.statusLinea || body.fechaActivacion)) {
        const telExistente = await storage.getPersonaTelefonoByNumero(telefonoNumero);
        if (telExistente) {
          await storage.updatePersonaTelefono(telExistente.id, {
            statusLinea: body.statusLinea || undefined,
            fechaActivacion: body.fechaActivacion || undefined,
          });
        } else {
          await storage.createPersonaTelefono({
            personaId: persona.nro,
            numero: telefonoNumero,
            statusLinea: body.statusLinea || undefined,
            fechaActivacion: body.fechaActivacion || undefined,
          });
        }
      }

      const validatedCase = insertExpedienteSujetoSchema.parse({ ...caseFields, personaId: persona.nro });
      const expediente = await storage.createExpedienteSujeto(validatedCase);

      res.status(201).json({ persona, expediente });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear persona/caso" });
    }
  });

  app.put("/api/personas-casos/:nro", authenticateToken, async (req: any, res) => {
    try {
      const nro = parseInt(req.params.nro);
      const validatedData = insertPersonaCasoSchema.partial().parse(req.body);
      const updated = await storage.updatePersonaCaso(nro, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Persona caso no encontrada" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al actualizar persona caso" });
    }
  });

  app.delete("/api/personas-casos/:nro", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const nro = parseInt(req.params.nro);
      const deleted = await storage.deletePersonaCaso(nro);
      if (!deleted) {
        return res.status(404).json({ message: "Persona caso no encontrada" });
      }
      res.json({ message: "Persona caso eliminada correctamente" });
    } catch (error: any) {
      res.status(500).json({ message: "Error al eliminar persona caso" });
    }
  });

  // Buscar persona por cédula (para auto-relleno en formularios)
  app.get("/api/personas-casos/by-cedula/:cedula", authenticateToken, async (req: any, res) => {
    try {
      const { cedula } = req.params;
      if (!cedula || cedula.length < 5) {
        return res.status(400).json({ message: "Cédula muy corta" });
      }
      const persona = await storage.findPersonaByCedula(cedula);
      if (!persona) {
        return res.status(404).json({ message: "Sujeto no encontrado en el historial" });
      }
      res.json(persona);
    } catch (error: any) {
      res.status(500).json({ message: "Error al buscar persona por cédula" });
    }
  });

  // Obtener persona/caso completo con teléfonos asociados
  app.get("/api/personas-casos/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const persona = await storage.getPersonaCasoById(id);
      if (!persona) {
        return res.status(404).json({ message: "Persona/caso no encontrado" });
      }
      const telefonos = await db
        .select()
        .from(personaTelefonos)
        .where(eq(personaTelefonos.personaId, id));
      res.json({ ...persona, telefonosAsociados: telefonos });
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener persona/caso" });
    }
  });

  // ── Expedientes Sujetos ───────────────────────────────────────────────────

  app.get("/api/expedientes-sujetos/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const expediente = await storage.getExpedienteSujetoById(id);
      if (!expediente) {
        return res.status(404).json({ message: "Expediente no encontrado" });
      }
      const persona = expediente.personaId
        ? await storage.getPersonaCasoById(expediente.personaId)
        : null;
      res.json({
        id: expediente.id,
        nro: persona?.nro,
        personaId: persona?.nro,
        cedula: persona?.cedula,
        nombre: persona?.nombre,
        apellido: persona?.apellido,
        edad: persona?.edad,
        fechaDeNacimiento: persona?.fechaDeNacimiento,
        profesion: persona?.profesion,
        correo: persona?.correo,
        direccion: persona?.direccion,
        telefono: expediente.telefonoCaso,
        telefonoCaso: expediente.telefonoCaso,
        expediente: expediente.expediente,
        pseudonimo: expediente.pseudonimo,
        delito: expediente.delito,
        fiscalia: expediente.fiscalia,
        nOficio: expediente.nOficio,
        fechaDeInicio: expediente.fechaDeInicio,
        descripcion: expediente.descripcion,
        observacion: expediente.observacion,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener expediente" });
    }
  });

  app.put("/api/expedientes-sujetos/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const body = req.body;

      const expediente = await storage.getExpedienteSujetoById(id);
      if (!expediente) {
        return res.status(404).json({ message: "Expediente no encontrado" });
      }

      if (expediente.personaId) {
        const bioFields = {
          cedula: body.cedula,
          nombre: body.nombre,
          apellido: body.apellido,
          edad: body.edad,
          fechaDeNacimiento: body.fechaDeNacimiento,
          profesion: body.profesion,
          correo: body.correo,
          direccion: body.direccion,
        };
        const validatedBio = insertPersonaCasoSchema.partial().parse(bioFields);
        await storage.updatePersonaCaso(expediente.personaId, validatedBio);
      }

      const caseFields = {
        telefonoCaso: body.telefono || body.telefonoCaso,
        expediente: body.expediente,
        pseudonimo: body.pseudonimo,
        delito: body.delito,
        fiscalia: body.fiscalia,
        nOficio: body.nOficio,
        fechaDeInicio: body.fechaDeInicio,
        descripcion: body.descripcion,
        observacion: body.observacion,
      };
      const validatedCase = insertExpedienteSujetoSchema.partial().parse(caseFields);
      const updatedExp = await storage.updateExpedienteSujeto(id, validatedCase);

      res.json({ message: "Actualizado correctamente", expediente: updatedExp });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al actualizar expediente" });
    }
  });

  // ── Persona Teléfonos ─────────────────────────────────────────────────────

  app.get("/api/persona-telefonos/persona/:personaId", authenticateToken, async (req: any, res) => {
    try {
      const personaId = parseInt(req.params.personaId);
      const telefonos = await storage.getPersonaTelefonos(personaId);
      res.json(telefonos);
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener teléfonos" });
    }
  });

  app.get("/api/persona-telefonos/numero/:numero", authenticateToken, async (req: any, res) => {
    try {
      const { numero } = req.params;
      const telefono = await storage.getPersonaTelefonoByNumero(numero);
      if (!telefono) {
        return res.status(404).json({ message: "Teléfono no encontrado" });
      }
      res.json(telefono);
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener teléfono" });
    }
  });

  app.get("/api/persona-telefonos/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const telefono = await storage.getPersonaTelefonoById(id);
      if (!telefono) {
        return res.status(404).json({ message: "Teléfono no encontrado" });
      }
      res.json(telefono);
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener teléfono" });
    }
  });

  app.post("/api/persona-telefonos", authenticateToken, async (req: any, res) => {
    try {
      const validatedData = insertPersonaTelefonoSchema.parse(req.body);
      const newTelefono = await storage.createPersonaTelefono(validatedData);
      res.status(201).json(newTelefono);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear teléfono" });
    }
  });

  app.post("/api/persona-telefonos/bulk", authenticateToken, async (req: any, res) => {
    try {
      const { telefonos } = req.body;
      if (!Array.isArray(telefonos)) {
        return res.status(400).json({ message: "Se esperaba un array de teléfonos" });
      }
      const validatedData = telefonos.map((t) => insertPersonaTelefonoSchema.parse(t));
      const newTelefonos = await storage.createPersonaTelefonosBulk(validatedData);
      res.status(201).json({
        message: `${newTelefonos.length} teléfonos creados correctamente`,
        telefonos: newTelefonos,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear teléfonos" });
    }
  });

  app.put("/api/persona-telefonos/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertPersonaTelefonoSchema.partial().parse(req.body);
      const updated = await storage.updatePersonaTelefono(id, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Teléfono no encontrado" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al actualizar teléfono" });
    }
  });

  app.delete("/api/persona-telefonos/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePersonaTelefono(id);
      if (!deleted) {
        return res.status(404).json({ message: "Teléfono no encontrado" });
      }
      res.json({ message: "Teléfono eliminado correctamente" });
    } catch (error: any) {
      res.status(500).json({ message: "Error al eliminar teléfono" });
    }
  });

  // ── Trazabilidad: Búsqueda general ───────────────────────────────────────

  app.get("/api/trazabilidad/buscar", authenticateToken, async (req: any, res) => {
    try {
      const { tipo, valor } = req.query;

      console.log(`\n🔍 [TRAZABILIDAD BUSCAR] ──────────────────────────────`);
      console.log(`   Tipo de búsqueda : "${tipo}"`);
      console.log(`   Valor buscado    : "${valor}"`);

      if (!tipo || !valor) {
        console.log(`   ❌ Parámetros incompletos — abortando`);
        return res.status(400).json({ message: "Se requieren los parámetros tipo y valor" });
      }

      const joinSelect = {
        id: expedientesSujetos.id,
        personaId: personasCasos.nro,
        expediente: expedientesSujetos.expediente,
        cedula: personasCasos.cedula,
        nombre: personasCasos.nombre,
        apellido: personasCasos.apellido,
        numeroAsociado: expedientesSujetos.telefonoCaso,
        delito: expedientesSujetos.delito,
        createdAt: expedientesSujetos.createdAt,
      };

      const mapRow = (row: any) => ({
        id: row.id,
        personaId: row.personaId,
        expediente: row.expediente,
        cedula: row.cedula,
        nombreCompleto: `${row.nombre || ""} ${row.apellido || ""}`.trim(),
        numeroAsociado: row.numeroAsociado,
        delito: row.delito,
        fechaRegistro: row.createdAt,
      });

      let resultados: any[] = [];

      switch (tipo) {
        case "cedula": {
          console.log(`   📋 Consulta: expedientes_sujetos INNER JOIN personas_casos`);
          console.log(`      WHERE personas_casos.cedula = '${valor}'`);
          const rows = await db
            .select(joinSelect)
            .from(expedientesSujetos)
            .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
            .where(eq(personasCasos.cedula, valor as string));
          console.log(`   📦 Filas crudas devueltas por DB: ${rows.length}`);
          resultados = rows.map(mapRow);
          break;
        }

        case "nombre": {
          console.log(`   📋 Consulta: expedientes_sujetos INNER JOIN personas_casos`);
          console.log(`      WHERE nombre ILIKE '%${valor}%' OR apellido ILIKE '%${valor}%'`);
          const rows = await db
            .select(joinSelect)
            .from(expedientesSujetos)
            .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
            .where(
              sql`LOWER(${personasCasos.nombre}) LIKE LOWER(${"%" + valor + "%"}) OR LOWER(${personasCasos.apellido}) LIKE LOWER(${"%" + valor + "%"})`
            );
          console.log(`   📦 Filas crudas devueltas por DB: ${rows.length}`);
          resultados = rows.map(mapRow);
          break;
        }

        case "seudonimo": {
          console.log(`   📋 Consulta: expedientes_sujetos INNER JOIN personas_casos`);
          console.log(`      WHERE pseudonimo ILIKE '%${valor}%'`);
          const rows = await db
            .select(joinSelect)
            .from(expedientesSujetos)
            .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
            .where(sql`LOWER(${expedientesSujetos.pseudonimo}) LIKE LOWER(${"%" + valor + "%"})`);
          console.log(`   📦 Filas crudas devueltas por DB: ${rows.length}`);
          resultados = rows.map(mapRow);
          break;
        }

        case "numero": {
          console.log(`   📋 Consulta: expedientes_sujetos INNER JOIN personas_casos`);
          console.log(`      WHERE expedientes_sujetos.telefono_caso LIKE '%${valor}%'`);
          const rowsExp = await db
            .select(joinSelect)
            .from(expedientesSujetos)
            .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
            .where(sql`${expedientesSujetos.telefonoCaso} LIKE ${"%" + valor + "%"}`);
          console.log(`   📦 Filas crudas devueltas por DB: ${rowsExp.length}`);
          resultados = rowsExp.map(mapRow);
          break;
        }

        case "expediente": {
          console.log(`   📋 Consulta: expedientes_sujetos INNER JOIN personas_casos`);
          console.log(`      WHERE expediente ILIKE '%${valor}%'`);
          const rows = await db
            .select(joinSelect)
            .from(expedientesSujetos)
            .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
            .where(sql`LOWER(${expedientesSujetos.expediente}) LIKE LOWER(${"%" + valor + "%"})`);
          console.log(`   📦 Filas crudas devueltas por DB: ${rows.length}`);
          resultados = rows.map(mapRow);
          break;
        }

        default:
          console.log(`   ❌ Tipo de búsqueda no reconocido: "${tipo}"`);
          return res.status(400).json({ message: "Tipo de búsqueda no válido" });
      }

      console.log(`   ✅ Total resultados finales enviados al cliente: ${resultados.length}`);
      if (resultados.length > 0) {
        console.log(`   📊 Detalle de resultados:`);
        resultados.forEach((r, i) => {
          console.log(`      [${i + 1}] expediente="${r.expediente}" | cédula="${r.cedula}" | nombre="${r.nombreCompleto}" | número="${r.numeroAsociado}" | fechaRegistro="${r.fechaRegistro}"`);
        });
      } else {
        console.log(`   ⚠️  No se encontraron resultados para la búsqueda`);
      }
      console.log(`──────────────────────────────────────────────────────\n`);

      res.json({
        resultados,
        total: resultados.length,
        tipoBusqueda: tipo,
        valorBusqueda: valor,
      });
    } catch (error: any) {
      console.log(`   💥 [TRAZABILIDAD BUSCAR] Error: ${error.message}`);
      res.status(500).json({ message: "Error al buscar trazabilidad" });
    }
  });

  // ── Trazabilidad: Análisis detallado (grafo de comunicaciones) ────────────

  app.get("/api/trazabilidad/coincidencias/:numero", authenticateToken, async (req: any, res) => {
    try {
      const { numero } = req.params;

      const numerosContactados = new Set<string>();
      // Solo valores que parecen números telefónicos reales (7+ dígitos)
      const ES_TELEFONO = /^\d{7,}$/;

      // ── Lado A: todos los registros del sujeto (via FK abonadoAId) ──
      // Digitel almacena el sujeto en CUALQUIER columna (A o B según entrante/saliente),
      // por eso se agregan ambos lados descartando el propio número y no-numéricos.
      const registrosComoA = await storage.getRegistrosComunicacionByAbonado(numero);
      registrosComoA.forEach((reg) => {
        const a = (reg.abonadoA || "").trim();
        const b = (reg.abonadoB || "").trim();
        if (a !== numero && ES_TELEFONO.test(a)) numerosContactados.add(a);
        if (b !== numero && ES_TELEFONO.test(b)) numerosContactados.add(b);
      });

      // ── Bidireccional: registros de otros sujetos que contactaron a este número ──
      const registrosComoB = await db
        .select()
        .from(registrosComunicacion)
        .where(eq(registrosComunicacion.abonadoB, numero));
      registrosComoB.forEach((reg) => {
        const a = (reg.abonadoA || "").trim();
        if (a !== numero && ES_TELEFONO.test(a)) numerosContactados.add(a);
      });

      const coincidenciasMap = new Map<string, any>();

      for (const numContactado of Array.from(numerosContactados)) {
        const telefonos = await db
          .select()
          .from(personaTelefonos)
          .where(eq(personaTelefonos.numero, numContactado));

        for (const tel of telefonos) {
          if (!tel.personaId) continue;
          const persona = await storage.getPersonaCasoById(tel.personaId);
          if (!persona) continue;

          // ── Obtener expedientes reales desde expedientesSujetos ──
          const expedientes = await db
            .select()
            .from(expedientesSujetos)
            .where(eq(expedientesSujetos.personaId, persona.nro));

          const key = `${numContactado}-${persona.nro}`;
          if (!coincidenciasMap.has(key)) {
            coincidenciasMap.set(key, {
              numeroContactado: numContactado,
              persona: {
                id: persona.nro,
                cedula: persona.cedula,
                nombreCompleto: `${persona.nombre} ${persona.apellido}`,
                expedientes: expedientes.map((e) => ({
                  expediente: e.expediente || "—",
                  delito: e.delito || "—",
                  fiscalia: e.fiscalia || "—",
                  nOficio: e.nOficio || "—",
                })),
              },
            });
          }
        }
      }

      const coincidencias = Array.from(coincidenciasMap.values());

      res.json({
        numeroAnalizado: numero,
        totalContactos: numerosContactados.size,
        coincidenciasEncontradas: coincidencias.length,
        coincidencias,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error al buscar coincidencias" });
    }
  });

  app.get("/api/trazabilidad/:numero", authenticateToken, async (req: any, res) => {
    try {
      const { numero } = req.params;

      const registros = await storage.getRegistrosComunicacionByAbonado(numero);

      const numerosUnicos = new Set<string>();
      numerosUnicos.add(numero);
      registros.forEach((reg) => {
        if (reg.abonadoA) numerosUnicos.add(reg.abonadoA);
        if (reg.abonadoB) numerosUnicos.add(reg.abonadoB);
      });

      const numeroPersonaMap = new Map<string, any>();
      const numeroIconoMap = new Map<string, string | null>();

      for (const num of Array.from(numerosUnicos)) {
        const telefonos = await db
          .select()
          .from(personaTelefonos)
          .where(eq(personaTelefonos.numero, num));

        if (telefonos.length > 0) {
          numeroIconoMap.set(num, telefonos[0].iconoTipo || null);

          if (telefonos[0].personaId) {
            const persona = await storage.getPersonaCasoById(telefonos[0].personaId);
            if (persona) {
              const exps = await storage.getExpedientesSujetosByPersonaId(persona.nro);
              const exp = exps[0];
              numeroPersonaMap.set(num, {
                personaId: persona.nro,
                nombreCompleto: `${persona.nombre} ${persona.apellido}`,
                cedula: persona.cedula,
                delito: exp?.delito ?? null,
                expediente: exp?.expediente ?? null,
                fiscalia: exp?.fiscalia ?? null,
              });
            }
          }
        }
      }

      const nodos: any[] = [];
      for (const num of Array.from(numerosUnicos)) {
        const isCentral = num === numero;
        const personaInfo = numeroPersonaMap.get(num);

        let type: string;
        let label: string;

        if (isCentral) {
          type = "Principal";
          label = personaInfo ? `${num} (${personaInfo.nombreCompleto})` : num;
        } else if (personaInfo) {
          type = "Coincidente";
          label = `${num} (${personaInfo.nombreCompleto})`;
        } else {
          type = "Externo";
          label = num;
        }

        nodos.push({
          id: num,
          label,
          type,
          personaId: personaInfo?.personaId || null,
          isCentral,
          iconoTipo: numeroIconoMap.get(num) || null,
          metadata: personaInfo
            ? {
                cedula: personaInfo.cedula,
                delito: personaInfo.delito,
                expediente: personaInfo.expediente,
                nombreCompleto: personaInfo.nombreCompleto,
                fiscalia: personaInfo.fiscalia,
              }
            : undefined,
        });
      }

      const aristas: any[] = [];
      const weightMap = new Map<string, number>();

      registros.forEach((reg) => {
        const from = reg.abonadoA;
        const to = reg.abonadoB || "";
        const key = `${from}-${to}`;
        weightMap.set(key, (weightMap.get(key) || 0) + 1);

        const fechaHora =
          reg.fecha && reg.hora ? `${reg.fecha} ${reg.hora}` : reg.fecha || "Sin fecha";
        const title = `${reg.tipoTransaccion || "Comunicación"} - ${fechaHora}`;

        aristas.push({
          id: reg.registroId,
          from,
          to,
          title,
          weight: 1,
          transactionType: reg.tipoTransaccion || "Desconocido",
          metadata: {
            fecha: reg.fecha,
            hora: reg.hora,
            time: reg.time,
            btsCeldaA: reg.btsCeldaA,
            btsCeldaB: reg.btsCeldaB,
            direccionA: reg.direccionA,
            direccionB: reg.direccionB,
            coordenadasA: reg.coordenadasA,
            coordenadasB: reg.coordenadasB,
            orientacionA: reg.orientacionA,
            orientacionB: reg.orientacionB,
            imeiA: reg.imeiA,
            imeiB: reg.imeiB,
          },
        });
      });

      aristas.forEach((arista) => {
        const key = `${arista.from}-${arista.to}`;
        arista.weight = weightMap.get(key) || 1;
      });

      res.json({
        numeroAnalizado: numero,
        nodos,
        aristas,
        totalComunicaciones: registros.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error al analizar trazabilidad" });
    }
  });

  // ── Análisis de traza desde BD → Python ──────────────────────────────────

  app.get("/api/analisis-traza/:numero", authenticateToken, async (req: any, res) => {
    try {
      const { numero } = req.params;

      // 1. Obtener registros desde la BD (igual que "Ver Registros")
      const registros = await storage.getRegistrosComunicacionByAbonado(numero);

      if (!registros || registros.length === 0) {
        return res.json({
          contactosFrecuentes: [],
          imeis: [],
          georref: [],
          totalComunicaciones: 0,
        });
      }

      // 2. Enviar registros al Python FastAPI para análisis
      const pythonUrl = "http://localhost:8001/analizar-registros-db";
      const pythonRes = await fetch(pythonUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero, registros }),
      });

      if (!pythonRes.ok) {
        const errText = await pythonRes.text();
        return res.status(500).json({ message: `Error en análisis Python: ${errText}` });
      }

      const analisis = await pythonRes.json();
      res.json(analisis);
    } catch (error: any) {
      res.status(500).json({ message: "Error al analizar trazabilidad" });
    }
  });

  // ── Asignar icono a nodo del grafo ────────────────────────────────────────

  app.put("/api/asignar-icono", authenticateToken, async (req: any, res) => {
    try {
      const { numero, iconoTipo } = req.body;

      if (!numero) {
        return res.status(400).json({ message: "El número es requerido" });
      }

      const telefonos = await db
        .select()
        .from(personaTelefonos)
        .where(eq(personaTelefonos.numero, numero));

      if (telefonos.length === 0) {
        return res.status(404).json({ message: "Número no encontrado" });
      }

      await db
        .update(personaTelefonos)
        .set({ iconoTipo })
        .where(eq(personaTelefonos.numero, numero));

      res.json({ success: true, message: "Icono asignado correctamente", numero, iconoTipo });
    } catch (error: any) {
      res.status(500).json({ message: "Error al asignar icono" });
    }
  });

  // ── Exportar / Importar análisis (CSV) ────────────────────────────────────

  app.get("/api/exportar-analisis/:expediente", authenticateToken, async (req: any, res) => {
    try {
      const { expediente } = req.params;

      const expRows = await db
        .select({
          nro: personasCasos.nro,
          cedula: personasCasos.cedula,
          nombre: personasCasos.nombre,
          apellido: personasCasos.apellido,
        })
        .from(expedientesSujetos)
        .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
        .where(eq(expedientesSujetos.expediente, expediente));

      if (expRows.length === 0) {
        return res.status(404).json({ message: "No se encontraron registros para este expediente" });
      }

      const rows: any[] = [];
      for (const persona of expRows) {
        const telefonos = await db
          .select()
          .from(personaTelefonos)
          .where(eq(personaTelefonos.personaId, persona.nro));

        for (const tel of telefonos) {
          rows.push({
            Cedula: persona.cedula || "",
            Nombre: persona.nombre || "",
            Apellido: persona.apellido || "",
            Numero_Asociado: tel.numero,
            Tipo_de_Uso: tel.tipo || "",
            icono_tipo: tel.iconoTipo || "",
          });
        }
      }

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ message: "No se encontraron números asociados para este expediente" });
      }

      const headers = "Cedula,Nombre,Apellido,Numero_Asociado,Tipo_de_Uso,icono_tipo\n";
      const csvRows = rows
        .map(
          (row) =>
            `"${row.Cedula}","${row.Nombre}","${row.Apellido}","${row.Numero_Asociado}","${row.Tipo_de_Uso}","${row.icono_tipo}"`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="analisis_${expediente}_${Date.now()}.csv"`
      );
      res.send(headers + csvRows);
    } catch (error: any) {
      res.status(500).json({ message: "Error al exportar análisis" });
    }
  });

  app.post(
    "/api/importar-analisis",
    authenticateToken,
    csvUpload.single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No se proporcionó archivo CSV" });
        }

        const csvContent = req.file.buffer.toString("utf-8");
        const lines = csvContent.split("\n").filter((line: string) => line.trim());
        if (lines.length < 2) {
          return res.status(400).json({ message: "El archivo CSV está vacío o no tiene datos" });
        }

        const dataLines = lines.slice(1);
        let actualizados = 0;
        let errores = 0;

        for (const line of dataLines) {
          try {
            const match = line.match(
              /"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"/
            );
            if (match) {
              const [, , , , numeroAsociado, , iconoTipo] = match;
              const telefonos = await db
                .select()
                .from(personaTelefonos)
                .where(eq(personaTelefonos.numero, numeroAsociado));

              if (telefonos.length > 0) {
                await db
                  .update(personaTelefonos)
                  .set({ iconoTipo: iconoTipo || null })
                  .where(eq(personaTelefonos.numero, numeroAsociado));
                actualizados++;
              }
            }
          } catch (lineError) {
            errores++;
          }
        }

        res.json({
          success: true,
          message: "Importación completada",
          actualizados,
          errores,
          totalProcesados: dataLines.length,
        });
      } catch (error: any) {
        res.status(500).json({ message: "Error al importar análisis" });
      }
    }
  );

  // ── Registros de Comunicación ─────────────────────────────────────────────

  app.get("/api/registros-comunicacion", authenticateToken, async (req: any, res) => {
    try {
      const { abonadoA, abonadoB, fecha, page, limit } = req.query;
      const result = await storage.getRegistrosComunicacion({
        abonadoA: abonadoA as string,
        abonadoB: abonadoB as string,
        fecha: fecha as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener registros de comunicación" });
    }
  });

  app.get("/api/registros-comunicacion/abonado/:abonado", authenticateToken, async (req: any, res) => {
    try {
      const { abonado } = req.params;
      const registros = await storage.getRegistrosComunicacionByAbonado(abonado);
      res.json(registros);
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener registros de comunicación" });
    }
  });

  app.get("/api/registros-comunicacion/:registroId", authenticateToken, async (req: any, res) => {
    try {
      const registroId = parseInt(req.params.registroId);
      const registro = await storage.getRegistroComunicacionById(registroId);
      if (!registro) {
        return res.status(404).json({ message: "Registro de comunicación no encontrado" });
      }
      res.json(registro);
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener registro de comunicación" });
    }
  });

  app.post("/api/registros-comunicacion", authenticateToken, async (req: any, res) => {
    try {
      const validatedData = insertRegistroComunicacionSchema.parse(req.body);
      const newRegistro = await storage.createRegistroComunicacion(validatedData);
      res.status(201).json(newRegistro);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear registro de comunicación" });
    }
  });

  app.post("/api/registros-comunicacion/bulk", authenticateToken, async (req: any, res) => {
    try {
      const { registros } = req.body;
      if (!Array.isArray(registros)) {
        return res.status(400).json({ message: "Se esperaba un array de registros" });
      }
      const normalizedRegistros = registros.map((r: any) => ({
        ...r,
        coordenadasA: normalizarCoordenada(r.coordenadasA || ""),
        coordenadasB: normalizarCoordenada(r.coordenadasB || ""),
      }));
      const validatedData = normalizedRegistros.map((r) => insertRegistroComunicacionSchema.parse(r));
      const newRegistros = await storage.createRegistrosComunicacionBulk(validatedData);
      res.status(201).json({
        message: `${newRegistros.length} registros creados correctamente`,
        registros: newRegistros,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear registros de comunicación" });
    }
  });

  app.post(
    "/api/registros-comunicacion/importar",
    authenticateToken,
    uploadData.single("archivo"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No se ha enviado ningún archivo" });
        }

        const file = req.file;
        let registrosParaImportar: any[] = [];

        const mapearRegistro = (row: any): any => ({
          abonadoA: row["ABONADO A"] || row["abonado_a"] || row["AbonadoA"] || "",
          abonadoB: row["ABONADO B"] || row["abonado_b"] || row["AbonadoB"] || "",
          tipoTransaccion: row["Tipo Transacción"] || row["TIPO DE TRANSACCION"] || row["tipo_de_transaccion"] || row["TipoTransaccion"] || "",
          fecha: row["Fecha"] || row["FECHA"] || row["fecha"] || "",
          hora: row["Hora"] || row["HORA"] || row["hora"] || "",
          time: row["Time"] || row["TIME"] || row["SEG"] || row["seg"] || row["segundos"] || "",
          btsCeldaA: row["BTS-Celda A"] || row["bts_celda_a"] || row["BTS_CELDA_A"] || "",
          btsCeldaB: row["BTS-Celda B"] || row["bts_celda_b"] || row["BTS_CELDA_B"] || "",
          direccionA: row["Dirección A"] || row["DIRECCION A"] || row["direccion_a"] || row["Atena"] || row["DIRECCION"] || "",
          direccionB: row["Dirección B"] || row["DIRECCION B"] || row["direccion_b"] || "",
          coordenadasA: normalizarCoordenada(row["Coordenadas A"] || row["coordenadas_a"] || row["LATITUD CELDAD INICIO A"] || ""),
          coordenadasB: normalizarCoordenada(row["Coordenadas B"] || row["coordenadas_b"] || ""),
          orientacionA: row["Orientación A"] || row["orientacion_a"] || row["ORIENTACION A"] || "",
          orientacionB: row["Orientación B"] || row["orientacion_b"] || row["ORIENTACION B"] || "",
          imeiA: row["IMEI A"] || row["imei_a"] || row["IMEI ABONADO A"] || row["imei_abonado_a"] || "",
          imeiB: row["IMEI B"] || row["imei_b"] || row["IMEI ABONADO B"] || row["imei_abonado_b"] || "",
          archivo: file.originalname,
          peso: "",
        });

        if (
          file.mimetype ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          file.mimetype === "application/vnd.ms-excel"
        ) {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(file.buffer);
          const worksheet = workbook.getWorksheet(1);
          if (!worksheet) {
            return res.status(400).json({ message: "El archivo Excel no contiene hojas" });
          }
          const headers: any = {};
          const rows: any[] = [];
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
              row.eachCell((cell, colNumber) => {
                headers[colNumber] = cell.value?.toString().trim() || "";
              });
            } else {
              const rowData: any = {};
              row.eachCell((cell, colNumber) => {
                const headerName = headers[colNumber];
                if (headerName) rowData[headerName] = cell.value?.toString().trim() || "";
              });
              if (Object.keys(rowData).length > 0) rows.push(rowData);
            }
          });
          registrosParaImportar = rows.map(mapearRegistro);
        } else if (file.mimetype === "text/csv") {
          const csvContent = file.buffer.toString("utf-8");
          const lines = csvContent.split("\n").filter((line: string) => line.trim());
          if (lines.length < 2) {
            return res
              .status(400)
              .json({ message: "El archivo CSV debe contener encabezados y datos" });
          }
          const headers = lines[0].split(",").map((h: string) => h.trim().replace(/"/g, ""));
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((v: string) => v.trim().replace(/"/g, ""));
            const rowData: any = {};
            headers.forEach((header: string, index: number) => {
              rowData[header] = values[index] || "";
            });
            registrosParaImportar.push(mapearRegistro(rowData));
          }
        } else if (file.mimetype === "text/plain") {
          const txtContent = file.buffer.toString("utf-8");
          const lines = txtContent.split("\n").filter((line: string) => line.trim());
          if (lines.length < 2) {
            return res
              .status(400)
              .json({ message: "El archivo TXT debe contener encabezados y datos" });
          }
          const delimiter = lines[0].includes("\t") ? "\t" : ",";
          const headers = lines[0].split(delimiter).map((h: string) => h.trim().replace(/"/g, ""));
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i]
              .split(delimiter)
              .map((v: string) => v.trim().replace(/"/g, ""));
            const rowData: any = {};
            headers.forEach((header: string, index: number) => {
              rowData[header] = values[index] || "";
            });
            registrosParaImportar.push(mapearRegistro(rowData));
          }
        }

        registrosParaImportar = registrosParaImportar.filter((r) => r.abonadoA?.trim());

        if (registrosParaImportar.length === 0) {
          return res
            .status(400)
            .json({ message: "No se encontraron registros válidos en el archivo" });
        }

        const numerosUnicos = new Set<string>();
        registrosParaImportar.forEach((r) => {
          if (r.abonadoA) numerosUnicos.add(r.abonadoA.trim());
          if (r.abonadoB) numerosUnicos.add(r.abonadoB.trim());
        });

        const numerosTelefonoMap = new Map<string, number>();
        for (const numero of Array.from(numerosUnicos)) {
          let telefono = await storage.getPersonaTelefonoByNumero(numero);
          if (!telefono) {
            telefono = await storage.createPersonaTelefono({
              numero,
              tipo: "móvil",
              activo: true,
              personaId: null,
            });
          }
          numerosTelefonoMap.set(numero, telefono.id);
        }

        const registrosConIds = registrosParaImportar.map((r) => ({
          ...r,
          abonadoAId: r.abonadoA ? numerosTelefonoMap.get(r.abonadoA.trim()) || null : null,
          abonadoBId: r.abonadoB ? numerosTelefonoMap.get(r.abonadoB.trim()) || null : null,
          time: r.time || null,
        }));

        const newRegistros = await storage.createRegistrosComunicacionBulk(registrosConIds);

        res.status(201).json({
          message: "Registros importados correctamente",
          registrosImportados: newRegistros.length,
          telefonosNuevos: Array.from(numerosUnicos).length,
        });
      } catch (error: any) {
        res.status(500).json({
          message: "Error al importar registros de comunicación",
          error: error.message,
        });
      }
    }
  );

  app.put("/api/registros-comunicacion/:registroId", authenticateToken, async (req: any, res) => {
    try {
      const registroId = parseInt(req.params.registroId);
      const validatedData = insertRegistroComunicacionSchema.partial().parse(req.body);
      const updated = await storage.updateRegistroComunicacion(registroId, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Registro de comunicación no encontrado" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al actualizar registro de comunicación" });
    }
  });

  app.delete(
    "/api/registros-comunicacion/:registroId",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const registroId = parseInt(req.params.registroId);
        const deleted = await storage.deleteRegistroComunicacion(registroId);
        if (!deleted) {
          return res.status(404).json({ message: "Registro de comunicación no encontrado" });
        }
        res.json({ message: "Registro de comunicación eliminado correctamente" });
      } catch (error: any) {
        res.status(500).json({ message: "Error al eliminar registro de comunicación" });
      }
    }
  );

  // ── Trazabilidad: lookup por teléfono (JOIN con catálogo) ─────────────────

  app.get("/api/trazabilidad/telefono/:telefono", authenticateToken, async (req: any, res) => {
    try {
      const { telefono } = req.params;

      const telefonoCatalogo = await storage.getPersonaTelefonoByNumero(telefono);

      let persona = null;
      let todosLosTelefonos: any[] = [];
      let registrosPorIds: any[] = [];

      if (telefonoCatalogo && telefonoCatalogo.personaId) {
        persona = await storage.getPersonaCasoById(telefonoCatalogo.personaId);
        todosLosTelefonos = await storage.getPersonaTelefonos(telefonoCatalogo.personaId);
        const telefonoIds = todosLosTelefonos.map((t) => t.id);
        if (telefonoIds.length > 0) {
          registrosPorIds = await storage.getRegistrosComunicacionByTelefonoIds(telefonoIds);
        }
      }

      const registrosPorString = await storage.getRegistrosComunicacionByAbonado(telefono);

      const registrosMap = new Map();
      [...registrosPorIds, ...registrosPorString].forEach((r) => {
        registrosMap.set(r.registroId, r);
      });
      const registros = Array.from(registrosMap.values());

      res.json({
        persona,
        telefonosAsociados: todosLosTelefonos,
        registrosComunicacion: registros,
        totalRegistros: registros.length,
        esCatalogado: telefonoCatalogo !== null,
        busqueda: {
          porTelefonoId: registrosPorIds.length,
          porString: registrosPorString.length,
          total: registros.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error al obtener trazabilidad" });
    }
  });
}
