// ── Rutas de Análisis de Trazabilidad ──────────────────────────────────────
import type { Express } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { logger } from "./monitor/logger";
import {
  personasCasos,
  personaTelefonos,
  experticias,
  expedientesSujetos,
  registrosComunicacion,
} from "@shared/schema";
import { eq, sql, or, inArray } from "drizzle-orm";
import {
  insertPersonaCasoSchema,
  insertExpedienteSujetoSchema,
  insertPersonaTelefonoSchema,
  insertRegistroComunicacionSchema,
} from "@shared/schema";
import multer from "multer";
import ExcelJS from "exceljs";


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

      const result = await storage.upsertPersonaTelefono({
        numero,
        statusLinea: statusLinea || undefined,
        fechaActivacion: fechaActivacion || undefined,
      });
      return res.json(result);
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
        direccion: body.direccion,
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
        correo: body.correo,
        otrosTlf: body.otrosTlf || null,
        rol: body.rol || null,
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
      if (telefonoNumero) {
        await storage.upsertPersonaTelefono({
          personaId: persona.nro,
          numero: telefonoNumero,
          statusLinea: body.statusLinea || undefined,
          fechaActivacion: body.fechaActivacion || undefined,
        });
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

      logger.actividad({
        usuarioId: req.user?.id,
        username: req.user?.username,
        accion: "trazabilidad_info_persona",
        modulo: "Trazabilidad",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        detalle: `Info Persona/Caso: ${persona.nombre || ""} ${persona.apellido || ""} — C.I. ${persona.cedula || "s/n"}`.trim(),
      });
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
        correo: expediente.correo,
        otrosTlf: expediente.otrosTlf,
        rol: expediente.rol,
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
        correo: body.correo,
        otrosTlf: body.otrosTlf || null,
        rol: body.rol || null,
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
          const avanzada = req.query.avanzada === "true";

          if (avanzada && req.user?.rol !== "admin") {
            return res.status(403).json({ message: "Acceso restringido a administradores" });
          }

          if (!avanzada) {
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

          console.log(`   📋 Consulta AVANZADA: registros_comunicacion WHERE abonado_a = '${valor}' OR abonado_b = '${valor}'`);
          const registrosNumero = await db
            .select({
              fecha: registrosComunicacion.fecha,
            })
            .from(registrosComunicacion)
            .where(
              or(
                eq(registrosComunicacion.abonadoA, valor as string),
                eq(registrosComunicacion.abonadoB, valor as string)
              )
            );
          console.log(`   📦 Filas crudas devueltas por DB: ${registrosNumero.length}`);

          if (registrosNumero.length === 0) {
            resultados = [];
            res.json({
              resultados: [],
              numerosSinExpediente: [],
              total: 0,
              tipoBusqueda: tipo,
              valorBusqueda: valor,
            });
            return;
          }

          let primeraFecha: string | null = null;
          let ultimaFecha: string | null = null;
          for (const r of registrosNumero) {
            if (r.fecha && (!primeraFecha || r.fecha < primeraFecha)) primeraFecha = r.fecha;
            if (r.fecha && (!ultimaFecha || r.fecha > ultimaFecha)) ultimaFecha = r.fecha;
          }

          const rowsExpAvanzada = await db
            .select(joinSelect)
            .from(expedientesSujetos)
            .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
            .where(sql`${expedientesSujetos.telefonoCaso} LIKE ${"%" + valor + "%"}`);
          resultados = rowsExpAvanzada.map(mapRow);

          const numerosSinExpedienteAvanzada =
            resultados.length === 0
              ? [
                  {
                    numero: valor,
                    imeiCoincidente: null,
                    cantidadRegistros: registrosNumero.length,
                    primeraFecha,
                    ultimaFecha,
                  },
                ]
              : [];

          console.log(`   ✅ Con expediente: ${resultados.length} | Sin expediente: ${numerosSinExpedienteAvanzada.length}`);
          console.log(`──────────────────────────────────────────────────────\n`);

          res.json({
            resultados,
            numerosSinExpediente: numerosSinExpedienteAvanzada,
            total: resultados.length + numerosSinExpedienteAvanzada.length,
            tipoBusqueda: tipo,
            valorBusqueda: valor,
          });

          logger.actividad({
            usuarioId: req.user?.id,
            username: req.user?.username,
            accion: "trazabilidad_buscar",
            modulo: "Trazabilidad",
            resultado: "exitoso",
            ip: (req as any).clientIp,
            detalle: `Búsqueda avanzada por numero: ${valor} — ${resultados.length} con expediente, ${numerosSinExpedienteAvanzada.length} sin expediente`,
          });
          return;
        }

        case "imei": {
          if (req.user?.rol !== "admin") {
            return res.status(403).json({ message: "Acceso restringido a administradores" });
          }
          console.log(`   📋 Consulta: registros_comunicacion WHERE imei_a = '${valor}' OR imei_b = '${valor}'`);
          const registrosImei = await db
            .select({
              abonadoA: registrosComunicacion.abonadoA,
              abonadoB: registrosComunicacion.abonadoB,
              imeiA: registrosComunicacion.imeiA,
              imeiB: registrosComunicacion.imeiB,
              fecha: registrosComunicacion.fecha,
              hora: registrosComunicacion.hora,
              tipoTransaccion: registrosComunicacion.tipoTransaccion,
            })
            .from(registrosComunicacion)
            .where(
              or(
                eq(registrosComunicacion.imeiA, valor as string),
                eq(registrosComunicacion.imeiB, valor as string)
              )
            );
          console.log(`   📦 Filas crudas devueltas por DB: ${registrosImei.length}`);

          // Deduplicar por número: si coincide imei_a el número es abonado_a, si coincide imei_b es abonado_b
          const numerosMap = new Map<string, { numero: string; imeiCoincidente: string; cantidadRegistros: number; primeraFecha: string | null; ultimaFecha: string | null }>();
          for (const r of registrosImei) {
            const candidatos: string[] = [];
            if (r.imeiA === valor && r.abonadoA) candidatos.push(r.abonadoA);
            if (r.imeiB === valor && r.abonadoB) candidatos.push(r.abonadoB);
            for (const numero of candidatos) {
              const existente = numerosMap.get(numero);
              if (existente) {
                existente.cantidadRegistros += 1;
                if (r.fecha && (!existente.primeraFecha || r.fecha < existente.primeraFecha)) existente.primeraFecha = r.fecha;
                if (r.fecha && (!existente.ultimaFecha || r.fecha > existente.ultimaFecha)) existente.ultimaFecha = r.fecha;
              } else {
                numerosMap.set(numero, {
                  numero,
                  imeiCoincidente: valor as string,
                  cantidadRegistros: 1,
                  primeraFecha: r.fecha || null,
                  ultimaFecha: r.fecha || null,
                });
              }
            }
          }

          const numerosUnicos = Array.from(numerosMap.keys());
          console.log(`   🔢 Números únicos encontrados con ese IMEI: ${numerosUnicos.length}`);

          const numerosSinExpediente: any[] = [];
          if (numerosUnicos.length > 0) {
            const rowsExp = await db
              .select(joinSelect)
              .from(expedientesSujetos)
              .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
              .where(inArray(expedientesSujetos.telefonoCaso, numerosUnicos));
            resultados = rowsExp.map(mapRow);

            const numerosConExpediente = new Set(resultados.map((r) => r.numeroAsociado));
            for (const numero of numerosUnicos) {
              if (!numerosConExpediente.has(numero)) {
                numerosSinExpediente.push(numerosMap.get(numero));
              }
            }
          }

          console.log(`   ✅ Con expediente: ${resultados.length} | Sin expediente: ${numerosSinExpediente.length}`);
          console.log(`──────────────────────────────────────────────────────\n`);

          res.json({
            resultados,
            numerosSinExpediente,
            total: resultados.length + numerosSinExpediente.length,
            tipoBusqueda: tipo,
            valorBusqueda: valor,
          });

          logger.actividad({
            usuarioId: req.user?.id,
            username: req.user?.username,
            accion: "trazabilidad_buscar",
            modulo: "Trazabilidad",
            resultado: "exitoso",
            ip: (req as any).clientIp,
            detalle: `Búsqueda por imei: ${valor} — ${resultados.length} con expediente, ${numerosSinExpediente.length} sin expediente`,
          });
          return;
        }

        case "expediente": {
          console.log(`   📋 Consulta: expedientes_sujetos INNER JOIN personas_casos`);
          console.log(`      WHERE expediente = '${valor}'`);
          const rows = await db
            .select(joinSelect)
            .from(expedientesSujetos)
            .innerJoin(personasCasos, eq(expedientesSujetos.personaId, personasCasos.nro))
            .where(eq(expedientesSujetos.expediente, valor as string));
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

      logger.actividad({
        usuarioId: req.user?.id,
        username: req.user?.username,
        accion: "trazabilidad_buscar",
        modulo: "Trazabilidad",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        detalle: `Búsqueda por ${tipo}: ${valor} — ${resultados.length} resultado(s)`,
      });
    } catch (error: any) {
      console.log(`   💥 [TRAZABILIDAD BUSCAR] Error: ${error.message}`);
      res.status(500).json({ message: "Error al buscar trazabilidad" });
    }
  });

  // ── Trazabilidad: Análisis detallado (grafo de comunicaciones) ────────────

  app.get("/api/trazabilidad/coincidencias/:numero", authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.rol !== "admin") {
        return res.status(403).json({ message: "Acceso restringido a administradores" });
      }
      const { numero } = req.params;
      const expedienteParam = (req.query.expediente as string) || "";
      const ES_TELEFONO = /^\d{7,}$/;

      // Helper: obtiene datos catalogados (persona) de un número, si existe
      const catalogoCache = new Map<string, any>();
      const obtenerCatalogo = async (num: string) => {
        if (catalogoCache.has(num)) return catalogoCache.get(num);
        const telefonos = await db
          .select()
          .from(personaTelefonos)
          .where(eq(personaTelefonos.numero, num));
        let info: any = null;
        for (const tel of telefonos) {
          if (!tel.personaId) continue;
          const persona = await storage.getPersonaCasoById(tel.personaId);
          if (!persona) continue;
          info = {
            cedula: persona.cedula || null,
            nombreCompleto: `${persona.nombre || ""} ${persona.apellido || ""}`.trim() || null,
          };
          break;
        }
        catalogoCache.set(num, info);
        return info;
      };

      // Helper: dado un número, devuelve todos sus registros de comunicación (como A o como B)
      const obtenerRegistros = async (num: string) => {
        return db
          .select()
          .from(registrosComunicacion)
          .where(
            or(
              eq(registrosComunicacion.abonadoA, num),
              eq(registrosComunicacion.abonadoB, num)
            )
          );
      };

      // ── 1) Determinar los números base para el cruce ──
      let numerosExpediente: string[] = [];

      if (expedienteParam === "all") {
        // Cruce total: todos los números únicos de la tabla registros_comunicacion
        const rowsA = await db
          .selectDistinct({ num: registrosComunicacion.abonadoA })
          .from(registrosComunicacion);
        const rowsB = await db
          .selectDistinct({ num: registrosComunicacion.abonadoB })
          .from(registrosComunicacion);
        const todosNums = new Set<string>();
        for (const r of rowsA) if (r.num && ES_TELEFONO.test(r.num.trim())) todosNums.add(r.num.trim());
        for (const r of rowsB) if (r.num && ES_TELEFONO.test(r.num.trim())) todosNums.add(r.num.trim());
        numerosExpediente = Array.from(todosNums);
      } else if (expedienteParam) {
        // Uno o varios expedientes separados por coma sin espacio
        const listaExpedientes = expedienteParam.split(",").map((e) => e.trim()).filter(Boolean);
        const numerosSet = new Set<string>();
        for (const exp of listaExpedientes) {
          const sujetosExpediente = await db
            .select()
            .from(expedientesSujetos)
            .where(eq(expedientesSujetos.expediente, exp));
          for (const s of sujetosExpediente) {
            const tel = (s.telefonoCaso || "").trim();
            if (ES_TELEFONO.test(tel)) numerosSet.add(tel);
          }
        }
        numerosExpediente = Array.from(numerosSet);
      }

      if (numerosExpediente.length === 0 && ES_TELEFONO.test(numero)) {
        numerosExpediente = [numero];
      }

      // ── 2) Terceros en común: contactos compartidos entre 2+ números del expediente ──
      const tercerosMap = new Map<
        string,
        { numero: string; contactosPorNumero: Map<string, number>; totalRegistros: number }
      >();

      for (const numExp of numerosExpediente) {
        const registros = await obtenerRegistros(numExp);
        for (const r of registros) {
          const a = (r.abonadoA || "").trim();
          const b = (r.abonadoB || "").trim();
          let contacto: string | null = null;
          if (a === numExp && ES_TELEFONO.test(b)) contacto = b;
          else if (b === numExp && ES_TELEFONO.test(a)) contacto = a;
          if (!contacto || contacto === numExp) continue;
          // No contar como "tercero" a otro número que también pertenece al expediente
          if (numerosExpediente.includes(contacto)) continue;

          let entry = tercerosMap.get(contacto);
          if (!entry) {
            entry = { numero: contacto, contactosPorNumero: new Map(), totalRegistros: 0 };
            tercerosMap.set(contacto, entry);
          }
          entry.contactosPorNumero.set(numExp, (entry.contactosPorNumero.get(numExp) || 0) + 1);
          entry.totalRegistros += 1;
        }
      }

      const terceros: any[] = [];
      for (const entry of Array.from(tercerosMap.values())) {
        if (entry.contactosPorNumero.size < 2) continue; // solo terceros en común con 2+ números del expediente
        const persona = await obtenerCatalogo(entry.numero);
        terceros.push({
          numero: entry.numero,
          cedula: persona?.cedula || null,
          nombreCompleto: persona?.nombreCompleto || null,
          catalogado: !!persona,
          numerosExpedienteContactados: Array.from(entry.contactosPorNumero.entries()).map(
            ([num, cantidad]) => ({ numero: num, cantidadRegistros: cantidad })
          ),
          totalRegistros: entry.totalRegistros,
        });
      }
      terceros.sort((x, y) => y.totalRegistros - x.totalRegistros);

      // ── 3) IMEIs compartidos: a nivel global (todo el sistema, sin límite de expediente) ──
      const imeisDelExpediente = new Set<string>();
      for (const numExp of numerosExpediente) {
        const registros = await obtenerRegistros(numExp);
        for (const r of registros) {
          const a = (r.abonadoA || "").trim();
          const b = (r.abonadoB || "").trim();
          if (a === numExp && r.imeiA) imeisDelExpediente.add(r.imeiA.trim());
          if (b === numExp && r.imeiB) imeisDelExpediente.add(r.imeiB.trim());
        }
      }

      const imeisCompartidos: any[] = [];
      for (const imei of Array.from(imeisDelExpediente)) {
        if (!imei) continue;
        const registrosImei = await db
          .select()
          .from(registrosComunicacion)
          .where(
            or(
              eq(registrosComunicacion.imeiA, imei),
              eq(registrosComunicacion.imeiB, imei)
            )
          );

        const numerosUsuarios = new Set<string>();
        for (const r of registrosImei) {
          const a = (r.abonadoA || "").trim();
          const b = (r.abonadoB || "").trim();
          if (r.imeiA === imei && ES_TELEFONO.test(a)) numerosUsuarios.add(a);
          if (r.imeiB === imei && ES_TELEFONO.test(b)) numerosUsuarios.add(b);
        }

        if (numerosUsuarios.size < 2) continue; // solo IMEIs usados por más de un número

        const numerosInfo = [];
        for (const num of Array.from(numerosUsuarios)) {
          const persona = await obtenerCatalogo(num);
          numerosInfo.push({
            numero: num,
            cedula: persona?.cedula || null,
            nombreCompleto: persona?.nombreCompleto || null,
            catalogado: !!persona,
            esDelExpediente: numerosExpediente.includes(num),
          });
        }

        imeisCompartidos.push({ imei, numeros: numerosInfo });
      }

      // Enriquecer numerosExpediente con datos de catálogo
      const numerosExpedienteInfo: any[] = [];
      for (const num of numerosExpediente) {
        const persona = await obtenerCatalogo(num);
        numerosExpedienteInfo.push({
          numero: num,
          cedula: persona?.cedula || null,
          nombreCompleto: persona?.nombreCompleto || null,
          catalogado: !!persona,
        });
      }

      res.json({
        numeroAnalizado: numero,
        expediente: expedienteParam || null,
        numerosExpediente,
        numerosExpedienteInfo,
        terceros,
        imeisCompartidos,
      });

      logger.actividad({
        usuarioId: req.user?.id,
        username: req.user?.username,
        accion: "trazabilidad_analizar_traza",
        modulo: "Trazabilidad",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        detalle: `Cruce de traza: ${numero} (expediente ${expedienteParam || "N/A"}) — ${terceros.length} tercero(s), ${imeisCompartidos.length} IMEI(s) compartido(s)`,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error al buscar coincidencias" });
    }
  });

  // ── Análisis de traza desde BD → Python ──────────────────────────────────

  app.get("/api/analisis-traza/:numero", authenticateToken, async (req: any, res) => {
    try {
      const { numero } = req.params;
      const expedienteSujetoId = req.query.expedienteSujetoId ? parseInt(req.query.expedienteSujetoId as string) : undefined;

      // 1. Obtener registros desde la BD (igual que "Ver Registros")
      const registros = await storage.getRegistrosComunicacionByAbonado(numero, expedienteSujetoId);

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

      logger.actividad({
        usuarioId: req.user?.id,
        username: req.user?.username,
        accion: "trazabilidad_analisis_cdr",
        modulo: "Trazabilidad",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        detalle: `Análisis CDR: ${numero}`,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error al analizar trazabilidad" });
    }
  });

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
      const expedienteSujetoId = req.query.expedienteSujetoId ? parseInt(req.query.expedienteSujetoId as string) : undefined;
      const registros = await storage.getRegistrosComunicacionByAbonado(abonado, expedienteSujetoId);
      res.json(registros);

      logger.actividad({
        usuarioId: req.user?.id,
        username: req.user?.username,
        accion: "trazabilidad_ver_registros",
        modulo: "Trazabilidad",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        detalle: `Ver registros CDR: ${abonado} — ${registros.length} registro(s)`,
      });
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
      await storage.createRegistrosComunicacionBulk(validatedData);
      res.status(201).json({
        message: `${validatedData.length} registros creados correctamente`,
        registros: validatedData,
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
          const telefono = await storage.upsertPersonaTelefono({
            numero,
            tipo: "móvil",
            activo: true,
            personaId: null,
          });
          numerosTelefonoMap.set(numero, telefono.id);
        }

        const expedienteSujetoId = req.body.expedienteSujetoId ? parseInt(req.body.expedienteSujetoId) : null;

        const registrosConIds = registrosParaImportar.map((r) => ({
          ...r,
          abonadoAId: r.abonadoA ? numerosTelefonoMap.get(r.abonadoA.trim()) || null : null,
          expedienteSujetoId,
          time: r.time || null,
        }));

        await storage.createRegistrosComunicacionBulk(registrosConIds);

        res.status(201).json({
          message: "Registros importados correctamente",
          registrosImportados: registrosConIds.length,
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
