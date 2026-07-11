// Rutas para gestión de documentos (Word y Excel)
import type { Express } from "express";
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ExcelJS from 'exceljs';
import multer from 'multer';
import fetch from 'node-fetch';
import { parseWithPrefixes } from '../tools/utils_I';
import { experticias, insertExperticiasSchema, expedientesSujetos } from '../shared/schema';
import { db } from './db';
import { and, eq, sql } from 'drizzle-orm';
import { logger } from './monitor/logger';

/**
 * Convierte un tamaño en bytes a texto en KB con 2 decimales y coma
 * decimal (formato es-ES), ej: 98,00 KB.
 */
function formatearPesoKB(bytes: any): string {
  const n = Number(bytes);
  if (!n || isNaN(n) || n <= 0) return '';
  const kb = n / 1024;
  return `${kb.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KB`;
}

// Al inicio del archivo routes_gest.ts
const swiPdf = {
  downloadAsPdf: false,
  // otros valores de configuración...
};

// Configuración de multer para archivos Excel de experticias
const experticiasUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const experticiasDir = path.join(process.cwd(), 'uploads', 'experticias');
      if (!existsSync(experticiasDir)) {
        mkdirSync(experticiasDir, { recursive: true });
      }
      cb(null, experticiasDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `experticia-${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Solo archivos Excel
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xls, .xlsx)') as any, false);
    }
  }
});

// Funciones reutilizables para generación de documentos
export async function generateWordDocument(requestData: any, storage: any): Promise<Buffer | null> {
  try {
    const { tipoExperticia } = requestData;
    
    // 1. Validar existencia de plantilla y archivo
    const plantilla = await storage.getPlantillaWordByTipoExperticia(tipoExperticia);
    if (!plantilla || !existsSync(plantilla.archivo)) {
      return null;
    }
    
    // 2. Preparar datos para la plantilla
    const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const solicitudShort = requestData.numeroSolicitud?.split('-').pop() || requestData.numeroSolicitud || '';

    const templateData = {
      OFI: (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('delitos_propiedad')) 
         ? 'CIDCPROP' 
         : (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('delitos_personas')) 
         ? 'CIDCPER' 
         : (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('crimen_organizado')) 
         ? 'COLOCAR IDENTIFICADOR'
         : (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('delitos_vehiculos')) 
         ? 'CIRHV'
         : (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('homicidio')) 
         ? 'CIDCPER'
         : 'IDENTIFICAR OFICINA POR FAVOR!!!',
      SOLICITUD: solicitudShort,
      EXP: requestData.numeroExpediente || '',
      OPER: (requestData.operador || '').toUpperCase(),
      FECHA: currentDate,
      FISCAL: requestData.fiscal || '',
      DIR: requestData.direc || '',
      INFO_E: requestData.informacionLinea || '',
      INFO_R: requestData.descripcion || '',
      DESDE: requestData.fechaSolicitud || '',
      HASTA: requestData.fechaRespuesta || '',
      DELITO: requestData.delito || '',
    };

    // 3. Generar documento
    const content = readFileSync(plantilla.archivo, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(templateData);
    return doc.getZip().generate({ type: 'nodebuffer' });
    
  } catch (error) {
    console.error("Error generando documento Word:", error);
    return null;
  }
}

export async function generateExcelDocument(requestData: any): Promise<Buffer | null> {
  try {
    // Verificar que existe la plantilla Excel
    const excelTemplatePath = path.join(process.cwd(), 'uploads', 'PLANILLA DATOS.xlsx');
    if (!existsSync(excelTemplatePath)) {
      return null;
    }

    // Preparar datos para la plantilla
    const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const solicitudShort = requestData.numeroSolicitud?.split('-').pop() || requestData.numeroSolicitud || '';
    
    // Leer la plantilla Excel con ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelTemplatePath);
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) {
      return null;
    }

    // Generar mapeo de datos específico según el tipo de experticia
    let dataMappings = [];
    
    if (requestData.tipoExperticia === 'identificar_radio_bases_bts') {
      // Para BTS: dos filas con los mismos datos, excepto columna F
      dataMappings = [
        {
          'B2': solicitudShort,
          'C2': currentDate,
          'D2': 'Delegacion Municipal Quibor',
          'E2': requestData.numeroExpediente || '',
          'F2': requestData.informacionLinea || '',
          'G2': requestData.fechaSolicitud || '',
          'H2': requestData.fechaRespuesta || '',
          'J2': requestData.delito || '',
          'K2': requestData.fiscal || '',
        },
        {
          'B3': solicitudShort,
          'C3': currentDate,
          'D3': 'Delegacion Municipal Quibor',
          'E3': requestData.numeroExpediente || '',
          'F3': requestData.direc || '',
          'G3': requestData.fechaSolicitud || '',
          'H3': requestData.fechaRespuesta || '',
          'J3': requestData.delito || '',
          'K3': requestData.fiscal || '',
        }
      ];
    } else if (requestData.tipoExperticia === 'determinar_contacto_frecuente') {
      // Para Determinar Contacto Frecuente: una fila por cada número, CON fechas en columnas G y H
      const informacionLinea = requestData.informacionLinea || '';
      const numeros = informacionLinea.split(',').map((num: string) => num.trim()).filter((num: string) => num.length > 0);
      
      dataMappings = numeros.map((numero: string, index: number) => {
        const rowNumber = index + 2; // Empezar en fila 2, luego 3, 4, etc.
        return {
          [`B${rowNumber}`]: solicitudShort,
          [`C${rowNumber}`]: currentDate,
          [`D${rowNumber}`]: 'Delegacion Municipal Quibor',
          [`E${rowNumber}`]: requestData.numeroExpediente || '',
          [`F${rowNumber}`]: numero,
          [`G${rowNumber}`]: requestData.fechaSolicitud || '',  // Fecha inicio
          [`H${rowNumber}`]: requestData.fechaRespuesta || '',  // Fecha fin
          [`J${rowNumber}`]: requestData.delito || '',
          [`K${rowNumber}`]: requestData.fiscal || '',
        };
      });
      
      // Si no hay números, crear al menos una fila vacía
      if (dataMappings.length === 0) {
        dataMappings = [{
          'B2': solicitudShort,
          'C2': currentDate,
          'D2': 'Delegacion Municipal Quibor',
          'E2': requestData.numeroExpediente || '',
          'F2': '',
          'G2': requestData.fechaSolicitud || '',
          'H2': requestData.fechaRespuesta || '',
          'J2': requestData.delito || '',
          'K2': requestData.fiscal || '',
        }];
      }
    } else {
      // Para otros tipos de experticia: comportamiento normal (una sola fila)
      dataMappings = [
        {
          'B2': solicitudShort,
          'C2': currentDate,
          'D2': 'Delegacion Municipal Quibor',
          'E2': requestData.numeroExpediente || '',
          'F2': requestData.informacionLinea || '',
          'G2': requestData.fechaSolicitud || '',
          'H2': requestData.fechaRespuesta || '',
          'J2': requestData.delito || '',
          'K2': requestData.fiscal || '',
        }
      ];
    }

    // Aplicar los datos a las celdas preservando el formato
    dataMappings.forEach((dataMapping: Record<string, string>) => {
      Object.entries(dataMapping).forEach(([cellAddress, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          const cell = worksheet.getCell(cellAddress);
          cell.value = String(value);
        }
      });
    });

    // Generar el buffer del archivo Excel modificado
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
    
  } catch (error) {
    console.error("Error generando archivo Excel:", error);
    return null;
  }
}

export function registerDocumentRoutes(app: Express, authenticateToken: any, storage: any) {
  
  // Configuration route for PDF/Word format selection
  app.post("/api/config/download-format", authenticateToken, async (req: any, res) => {
    const { downloadAsPdf } = req.body;
    swiPdf.downloadAsPdf = downloadAsPdf;
    res.json({ success: true, downloadAsPdf });
  });

  // Ruta para subir archivos Excel de experticias
  app.post("/api/experticias/upload-archivo", authenticateToken, experticiasUpload.single('archivo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }

      // Retornar información del archivo subido
      const fileInfo = {
        nombreArchivo: req.file.originalname,
        tamañoArchivo: req.file.size,
        rutaArchivo: req.file.path,
        filename: req.file.filename
      };

      res.json({ 
        success: true, 
        message: "Archivo subido exitosamente",
        archivo: fileInfo
      });

    } catch (error) {
      console.error("Error subiendo archivo de experticia:", error);
      res.status(500).json({ message: "Error interno del servidor al subir archivo" });
    }
  });

  // Endpoint para analizar BTS usando API Python
  app.post("/api/experticias/analizar-bts", authenticateToken, async (req: any, res) => {
    try {
      const { archivo_excel, numero_buscar, operador } = req.body;
      
      if (!archivo_excel || !numero_buscar || !operador) {
        return res.status(400).json({ 
          success: false, 
          message: "Archivo Excel, número de búsqueda y operador son requeridos" 
        });
      }

      // Validar seguridad: solo permitir archivos en uploads/experticias
      const experticiasDir = path.join(process.cwd(), 'uploads', 'experticias');
      const normalizedPath = path.normalize(archivo_excel);
      const resolvedPath = path.resolve(normalizedPath);
      const resolvedExperticiasDir = path.resolve(experticiasDir);
      
      if (!resolvedPath.startsWith(resolvedExperticiasDir)) {
        return res.status(400).json({ 
          success: false, 
          message: "Acceso no autorizado: archivo fuera del directorio permitido" 
        });
      }

      // Verificar que el archivo existe
      if (!existsSync(resolvedPath)) {
        return res.status(404).json({ 
          success: false, 
          message: "Archivo Excel no encontrado" 
        });
      }

      // Llamar al API Python
      const pythonApiResponse = await fetch('http://localhost:8001/analizar-bts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archivo_excel: resolvedPath,
          numero_buscar: numero_buscar,
          operador: operador
        }),
      });

      if (!pythonApiResponse.ok) {
        const errorText = await pythonApiResponse.text();
        return res.status(500).json({ 
          success: false, 
          message: `Error en API Python: ${errorText}` 
        });
      }

      const pythonData = await pythonApiResponse.json();
      res.json(pythonData);

    } catch (error) {
      console.error("Error analizando BTS:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error interno del servidor al analizar BTS" 
      });
    }
  });

  // Endpoint PROXY para analizar Contactos Frecuentes (redirecciona a Python)
  app.post("/api/experticias/analizar-contactos-frecuentes", authenticateToken, async (req: any, res) => {
    try {

      const { archivo_excel, numero_buscar, operador } = req.body;
      
      if (!archivo_excel || !numero_buscar || !operador) {
        console.warn("[SERVIDOR CF] Faltan campos obligatorios:", { archivo_excel: !!archivo_excel, numero_buscar: !!numero_buscar, operador: !!operador });
        return res.status(400).json({ 
          success: false, 
          message: "Archivo Excel, número de búsqueda y operador son requeridos" 
        });
      }

      // Validar seguridad: solo permitir archivos en uploads/experticias
      const experticiasDir = path.join(process.cwd(), 'uploads', 'experticias');
      const normalizedPath = path.normalize(archivo_excel);
      const resolvedPath = path.resolve(normalizedPath);
      const resolvedExperticiasDir = path.resolve(experticiasDir);
      
      if (!resolvedPath.startsWith(resolvedExperticiasDir)) {
        return res.status(400).json({ 
          success: false, 
          message: "Acceso no autorizado: archivo fuera del directorio permitido" 
        });
      }

      // Verificar que el archivo existe
      if (!existsSync(resolvedPath)) {
        return res.status(404).json({ 
          success: false, 
          message: "Archivo Excel no encontrado" 
        });
      }

      // Llamar al API Python en puerto 8001
      const pythonApiResponse = await fetch('http://localhost:8001/analizar-contactos-frecuentes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archivo_excel: resolvedPath,
          numero_buscar: numero_buscar,
          operador: operador
        }),
      });

      if (!pythonApiResponse.ok) {
        const errorText = await pythonApiResponse.text();
        return res.status(500).json({ 
          success: false, 
          message: `Error en API Python: ${errorText}` 
        });
      }

      const pythonData = await pythonApiResponse.json();
      res.json(pythonData);

    } catch (error) {
      console.error("Error analizando Contactos Frecuentes:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error interno del servidor al analizar contactos frecuentes" 
      });
    }
  });
  
  // Ruta para generar plantilla Word personalizada
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
      const solicitudShort = requestData.numeroSolicitud?.split('-').pop() || requestData.numeroSolicitud || '';

      const templateData = {
        // Uso de un único estilo de nombre para los placeholders
        OFI: (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('delitos_propiedad')) 
           ? 'CIDCPROP' 
           : (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('delitos_personas')) 
           ? 'CIDCPER' 
           : (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('crimen_organizado')) 
           ? 'COLOCAR IDENTIFICADOR'
           : (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('delitos_vehiculos')) 
           ? 'CIRHV'
           : (requestData.coordinacionSolicitante && requestData.coordinacionSolicitante.includes('homicidio')) 
           ? 'CIDCPER'
           : 'IDENTIFICAR OFICINA POR FAVOR!!!',  // Valor por defecto

        SOLICITUD: solicitudShort,
        EXP: requestData.numeroExpediente || '',
        OPER: (requestData.operador || '').toUpperCase(),
        FECHA: currentDate,
        FISCAL: requestData.fiscal || '',
        DIR: requestData.direc || '',
        INFO_E: requestData.informacionLinea || '',
        INFO_R: requestData.descripcion || '',
        DESDE: requestData.fechaSolicitud || '',
        HASTA: requestData.fechaRespuesta || '',
        DELITO: requestData.delito || '',
      };

      let busArhivo: Buffer; // Variable para almacenar el buffer del archivo a enviar
      
      // Colocar Condicional Aquí
      if (swiPdf.downloadAsPdf) {
        console.log("PDF ListoS");
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

          // Generar Documento con Datos
          doc.render(templateData);

          // Obtener el buffer del documento generado con los datos
          busArhivo = doc.getZip().generate({ type: 'nodebuffer' });

        } catch (renderError: any) {
          // Si el renderizado falla, registramos el error y usamos la plantilla original
          console.error("Error al renderizar la plantilla con docxtemplater:", renderError);
          busArhivo = readFileSync(plantilla.archivo); // Usar la plantilla original
        }
        
        // 3. Configurar y enviar la respuesta (consolidado) (Nombre)
        const customFileName = `${plantilla.nombre}-${requestData.numeroSolicitud || 'plantilla'}.docx`;
        console.log("WORD ListoS");
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${customFileName}"`);
        res.send(busArhivo);
      }

    } catch (error) {
      // Manejo de errores generales (ej. problemas de base de datos o acceso a archivos antes del renderizado)
      res.status(500).json({ message: "Error generando plantilla personalizada" });
    }
  });

  // Ruta para generar archivo Excel con datos de solicitud
  app.post("/api/solicitudes/generate-excel", authenticateToken, async (req: any, res) => {
    try {
      const requestData = req.body;
      console.log("=== INICIO GENERACIÓN EXCEL ===");
      console.log("Datos recibidos:", JSON.stringify(requestData, null, 2));
      console.log("Tipo de datos:", typeof requestData);
      console.log("Keys disponibles:", Object.keys(requestData || {}));
      
      // Verificar que existe la plantilla Excel
      const excelTemplatePath = path.join(process.cwd(), 'uploads', 'PLANILLA DATOS.xlsx');
      console.log("Buscando plantilla en:", excelTemplatePath);
      if (!existsSync(excelTemplatePath)) {
        console.log("Plantilla Excel no encontrada");
        return res.status(404).json({ message: "Plantilla Excel no encontrada" });
      }

      // Preparar datos para la plantilla
      const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const solicitudShort = requestData.numeroSolicitud?.split('-').pop() || requestData.numeroSolicitud || '';
      
      // Parsear información de línea para extraer e: y r:
      const parsedLinea = parseWithPrefixes(requestData.informacionLinea || '', ['e', 'r']);
      
      // Parsear fecha de solicitud para extraer desde: y hasta:
      const parsedFechas = parseWithPrefixes(requestData.fecha_de_solicitud || '', ['desde', 'hasta']);
      
      // Determinar oficina basada en coordinación
      /*const oficina = (requestData.coordinacionSolicitante.includes('delitos_propiedad')) 
         ? 'CIDCPROP' 
         : (requestData.coordinacionSolicitante.includes('delitos_personas')) 
         ? 'CIDCPER' 
         : (requestData.coordinacionSolicitante.includes('crimen_organizado')) 
         ? 'CRIMEN ORGANIZADO'
         : (requestData.coordinacionSolicitante.includes('delitos_vehiculos')) 
         ? 'CIRHV'
         : (requestData.coordinacionSolicitante.includes('homicidio')) 
         ? 'CIDCPER'
         : 'OFICINA NO IDENTIFICADA';*/

      // Leer la plantilla Excel con ExcelJS para preservar formato
      console.log("Leyendo plantilla Excel con ExcelJS...");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(excelTemplatePath);
      const worksheet = workbook.getWorksheet(1); // Primera hoja
      
      if (!worksheet) {
        console.log("No se pudo acceder a la hoja de trabajo");
        return res.status(500).json({ message: "Error accediendo a la hoja de trabajo Excel" });
      }
      
      console.log("Plantilla Excel leída exitosamente con formato preservado");

      // Generar mapeo de datos específico según el tipo de experticia
      let dataMappings = [];
      
      if (requestData.tipoExperticia === 'identificar_radio_bases_bts') {
        // Para BTS: dos filas con los mismos datos, excepto columna F
        dataMappings = [
          {
            'B2': solicitudShort,                   // {SOLICITUD}
            'C2': currentDate,                      // {FECHA}
            'D2': 'Delegacion Municipal Quibor',    // {DM} - Despacho/Oficina
            'E2': requestData.numeroExpediente || '', // {EXP} - Expediente
            'F2': parsedLinea.r || requestData.informacionR || '',  // {INFO_R} - Información de línea R (primera fila)
            'G2': parsedFechas.desde || '',          // {DESDE}
            'H2': parsedFechas.hasta || '',          // {HASTA}
            'J2': requestData.delito || '',         // {delito}
            'K2': requestData.fiscal || '',
          },
          {
            'B3': solicitudShort,                   // {SOLICITUD}
            'C3': currentDate,                      // {FECHA}
            'D3': 'Delegacion Municipal Quibor',    // {DM} - Despacho/Oficina
            'E3': requestData.numeroExpediente || '', // {EXP} - Expediente
            'F3': parsedLinea.e || requestData.informacionE || '',   // {INFO_E} - Información de línea E (segunda fila)
            'G3': parsedFechas.desde || '',          // {DESDE}
            'H3': parsedFechas.hasta || '',          // {HASTA}
            'J3': requestData.delito || '',         // {delito}
            'K3': requestData.fiscal || '',
          }
        ];
      } else if (requestData.tipoExperticia === 'determinar_contacto_frecuente') {
        // Para Determinar Contacto Frecuente: una fila por cada número, CON fechas en columnas G y H
        const informacionLinea = requestData.informacionLinea || '';
        const numeros = informacionLinea.split(',').map((num: string) => num.trim()).filter((num: string) => num.length > 0);
        
        dataMappings = numeros.map((numero: string, index: number) => {
          const rowNumber = index + 2; // Empezar en fila 2, luego 3, 4, etc.
          return {
            [`B${rowNumber}`]: solicitudShort,                   // {SOLICITUD}
            [`C${rowNumber}`]: currentDate,                      // {FECHA}
            [`D${rowNumber}`]: 'Delegacion Municipal Quibor',    // {DM} - Despacho/Oficina
            [`E${rowNumber}`]: requestData.numeroExpediente || '', // {EXP} - Expediente
            [`F${rowNumber}`]: numero,                           // Número telefónico individual
            [`G${rowNumber}`]: parsedFechas.desde || '',         // {DESDE} - Fecha inicio
            [`H${rowNumber}`]: parsedFechas.hasta || '',         // {HASTA} - Fecha fin
            [`J${rowNumber}`]: requestData.delito || '',         // {delito}
            [`K${rowNumber}`]: requestData.fiscal || '',         // {fiscal}
          };
        });
        
        // Si no hay números, crear al menos una fila vacía
        if (dataMappings.length === 0) {
          dataMappings = [{
            'B2': solicitudShort,
            'C2': currentDate,
            'D2': 'Delegacion Municipal Quibor',
            'E2': requestData.numeroExpediente || '',
            'F2': '',
            'G2': parsedFechas.desde || '',
            'H2': parsedFechas.hasta || '',
            'J2': requestData.delito || '',
            'K2': requestData.fiscal || '',
          }];
        }
      } else {
        // Para otros tipos de experticia: comportamiento normal (una sola fila)
        dataMappings = [
          {
            'B2': solicitudShort,                   // {SOLICITUD}
            'C2': currentDate,                      // {FECHA}
            'D2': 'Delegacion Municipal Quibor',    // {DM} - Despacho/Oficina
            'E2': requestData.numeroExpediente || '', // {EXP} - Expediente
            'F2': requestData.informacionLinea || '',   // {INFO_E} - Dato Solicitado
            'G2': parsedFechas.desde || '',          // {DESDE}
            'H2': parsedFechas.hasta || '',          // {HASTA}
            'J2': requestData.delito || '',         // {delito}
            'K2': requestData.fiscal || '',
          }
        ];
      }

      console.log("Mapeo de datos para Excel:", JSON.stringify(dataMappings, null, 2));

      // Aplicar los datos a las celdas preservando el formato
      dataMappings.forEach((dataMapping: Record<string, string>) => {
        Object.entries(dataMapping).forEach(([cellAddress, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            const cell = worksheet.getCell(cellAddress);
            cell.value = String(value);
            // El formato y estilo de la celda se preserva automáticamente
          } else {
            //console.log(`Saltando celda ${cellAddress} - valor vacío o nulo:`, value);
          }
        });
      });

      // Generar el buffer del archivo Excel modificado
      //console.log("Generando buffer Excel con formato preservado...");
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const excelBuffer = Buffer.from(arrayBuffer);

      // Configurar respuesta para descarga
      const customFileName = `PLANILLA ${requestData.numeroSolicitud || 'solicitud'} ${req.user.delegacion}.xlsx`;
      
      console.log("EXCEL LISTO - enviando archivo:", customFileName);
      console.log(req.user.delegacion)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${customFileName}"`);
      res.send(excelBuffer);

    } catch (error) {
      console.error("Error generando archivo Excel:", error);
      res.status(500).json({ message: "Error generando archivo Excel" });
    }
  });

  // === RUTAS DE EXPERTICIAS ===
  
  // Ruta para generar documentos de experticia
  app.post("/api/plantillas-word/experticia/:tipoExperticia/generate", authenticateToken, async (req: any, res) => {
    try {
      const { tipoExperticia } = req.params;
      const requestData = req.body;

      // Buscar plantilla específica para experticia
      const plantilla = await storage.getPlantillaWordByTipoExperticiaTipoPlantilla(tipoExperticia, "experticia");
      if (!plantilla) {
        return res.status(404).json({ message: "No hay plantilla de experticia disponible para este tipo" });
      }
      if (!existsSync(plantilla.archivo)) {
        return res.status(404).json({ message: "Archivo de plantilla de experticia no encontrado" });
      }

      // Si viene experticiaid, buscar datos guardados de la base de datos
      let filasSeleccionadas = requestData.filasSeleccionadas;
      if (requestData.experticiaid && !filasSeleccionadas) {
        const experticia = await storage.getExperticia(parseInt(requestData.experticiaid));
        if (experticia?.datosSeleccionados) {
          filasSeleccionadas = experticia.datosSeleccionados;
        }
      }

      // Preparar datos para la plantilla de experticia
      const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
      
      // Parsear fechaRespuesta para extraer desde/hasta
      const regFechas = parseWithPrefixes(requestData.fechaRespuesta || '', ['desde', 'hasta']);
      
      const desp = 'BARQUISIMETO';
      // Procesar filas seleccionadas para la tabla dinámica
      const tabla = Array.isArray(filasSeleccionadas) 
        ? filasSeleccionadas.map((fila: any) => ({
            ABONADO_A: fila.ABONADO_A || '',
            ABONADO_B: fila.ABONADO_B || '',
            FECHA: fila.FECHA || '',
            HORA: fila.HORA || '',
            TIME: fila.TIME || '',
            DIRECCION: fila.DIRECCION || '',
            CORDENADAS: fila.CORDENADAS || '',
          }))
        : [];

      // Construir abonados_lista para la plantilla de Contacto Frecuente
      // Cada item: { NUM_ORD, NUMERO, DESDE, HASTA, CONTACTOS_TEXTO, datos filiatorios }
      const abonados_lista: Array<{
        NUM_ORD: string;
        NUMERO: string;
        DESDE: string;
        HASTA: string;
        CONTACTOS_TEXTO: string;
        CEDULA: string;
        NOMBRE: string;
        APELLIDO: string;
        FECHA_NAC: string;
        CORREO: string;
        STATUS_LINEA: string;
        FECHA_ACTIVACION: string;
        OTROS_TLF: string;
        DIRECCION: string;
      }> = [];

      // Texto con los archivos Excel adjuntos (uno por abonado), en el
      // formato "nombre1, con un peso de peso1, nombre2, con un peso de peso2"
      // para que se repita dentro de la misma oración cuando hay varios
      // números analizados.
      let archivosExcelTexto = '';

      if (tipoExperticia === 'determinar_contacto_frecuente') {
        const datosAnalisis = Array.isArray(requestData.datosAnalisis)
          ? requestData.datosAnalisis
          : [];

        if (datosAnalisis.length > 0) {
          // Modo multi-target: un objeto por cada número analizado
          datosAnalisis.forEach((item: any, idx: number) => {
            const top10: any[] = Array.isArray(item.top_10) ? item.top_10.slice(0, 10) : [];
            const contactosTexto = top10
              .map((c: any) => c.numero || c.CONTACTO || c.contacto || '')
              .filter(Boolean)
              .join(', ');

            abonados_lista.push({
              NUM_ORD: String(idx + 1),
              NUMERO: item.numero || '',
              DESDE: regFechas.desde || '',
              HASTA: regFechas.hasta || '',
              CONTACTOS_TEXTO: contactosTexto,
              // Datos filiatorios del abonado, provenientes del formulario
              // (sin consultar la base de datos).
              CEDULA: item.cedula || '',
              NOMBRE: item.nombre || '',
              APELLIDO: item.apellido || '',
              FECHA_NAC: item.fechaDeNacimiento || '',
              CORREO: item.correo || '',
              STATUS_LINEA: item.statusLinea || '',
              FECHA_ACTIVACION: item.fechaActivacion || '',
              OTROS_TLF: item.otrosTlf || '',
              DIRECCION: item.direccion || '',
            });
          });

          archivosExcelTexto = datosAnalisis
            .filter((item: any) => item.archivoNombre)
            .map((item: any) => {
              const peso = formatearPesoKB(item.tamanoArchivo);
              return peso ? `${item.archivoNombre}, con un peso de ${peso}` : item.archivoNombre;
            })
            .join(', ');
        } else if (requestData.abonado) {
          // Modo individual (un solo abonado)
          const top10: any[] = Array.isArray(requestData.todosLosContactos)
            ? requestData.todosLosContactos.slice(0, 10)
            : [];
          const contactosTexto = top10
            .map((c: any) => c.numero || c.CONTACTO || c.contacto || '')
            .filter(Boolean)
            .join(', ');

          abonados_lista.push({
            NUM_ORD: '1',
            NUMERO: requestData.abonado,
            DESDE: regFechas.desde || '',
            HASTA: regFechas.hasta || '',
            CONTACTOS_TEXTO: contactosTexto,
            CEDULA: requestData.cedula || '',
            NOMBRE: requestData.nombre || '',
            APELLIDO: requestData.apellido || '',
            FECHA_NAC: requestData.fechaDeNacimiento || '',
            CORREO: requestData.correo || '',
            STATUS_LINEA: requestData.statusLinea || '',
            FECHA_ACTIVACION: requestData.fechaActivacion || '',
            OTROS_TLF: requestData.otrosTlf || '',
            DIRECCION: requestData.direccion || '',
          });

          if (requestData.nombreArchivo) {
            const peso = formatearPesoKB(requestData.tamañoArchivo);
            archivosExcelTexto = peso
              ? `${requestData.nombreArchivo}, con un peso de ${peso}`
              : requestData.nombreArchivo;
          }
        }
      }

      const templateData = {
        FECHA: currentDate,
        UBICA: desp,
        FUBICA: desp.toLowerCase(),
        DICTAME: requestData.numeroDictamen || '',
        EXPERTO: requestData.experto || '',
        COMUNICACION: requestData.numeroComunicacion || '',
        FECHA_R: requestData.fechaComunicacion || '',
        CRED: req.user.credencial || 'No hay credencial',
        CARGO: (req.user as any).cargo || (req.user as any).rango || '',
        AP: requestData.ap || '',
        OPER: (requestData.operador || '').toUpperCase(),
        FRR: requestData.respuestaFechaCorreo || '',
        RTIME: requestData.horaRespuestaCorreo || '',
        EXCEL: tipoExperticia === 'determinar_contacto_frecuente'
          ? archivosExcelTexto
          : (requestData.nombreArchivo || ''),
        TAMAÑO: requestData.tamañoArchivo ? Number(requestData.tamañoArchivo).toLocaleString('es-ES') : '',
        EXP: requestData.expediente || '',
        DIREC: requestData.motivo || '',
        abonado: requestData.abonado || '',
        desde: regFechas.desde || '',
        hasta: regFechas.hasta || '',
        JERC: '',
        tabla: tabla,
        abonados_lista,
      };

      let busArchivo: Buffer;
      
      if (swiPdf.downloadAsPdf) {
        return res.status(200).json({ message: "Se solicitó la generación de PDF para experticia." });
      } else {
        try {
          const content = readFileSync(plantilla.archivo, 'binary');
          const zip = new PizZip(content);
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
          });

          doc.render(templateData);
          busArchivo = doc.getZip().generate({ type: 'nodebuffer' });

        } catch (renderError: any) {
          console.error("Error al renderizar plantilla de experticia:", renderError);
          busArchivo = readFileSync(plantilla.archivo);
        }
        
        const customFileName = `${plantilla.nombre}-${requestData.numeroDictamen || 'experticia'}.docx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${customFileName}"`);
        res.send(busArchivo);
      }

    } catch (error) {
      res.status(500).json({ message: "Error generando plantilla de experticia" });
    }
  });

  // GET /api/experticias - Get all experticias with filtering
  app.get("/api/experticias", authenticateToken, async (req: any, res) => {
    try {
      const {
        operador,
        estado,
        search,
        page,
        pageSize,
      } = req.query;

      const filters = {
        operador,
        estado,
        search,
        page: page ? parseInt(page) : 1,
        limit: pageSize ? parseInt(pageSize) : 10,
      };

      const result = await storage.getExperticias(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching experticias:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // GET /api/experticias/stats - Get aggregated experticias statistics
  app.get("/api/experticias/stats", authenticateToken, async (req: any, res) => {
    try {
      const stats = await storage.getExperticiasStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // GET /api/experticias/:id - Get single experticia
  app.get("/api/experticias/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const experticia = await storage.getExperticia(id);
      
      if (!experticia) {
        return res.status(404).json({ message: "Experticia no encontrada" });
      }

      res.json(experticia);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Función privada reutilizable: valida datos de experticia sin crear nada en BD.
  // Retorna null si es válido, o { status, message, errors? } si hay un error.
  async function validarDatosExperticia(body: any, user: any): Promise<{ status: number; message: string; errors?: any } | null> {
    if (!user || (user.rol !== 'admin' && user.rol !== 'supervisor')) {
      return { status: 403, message: 'No tienes permisos para crear experticias' };
    }
    const validation = insertExperticiasSchema.safeParse(body);
    if (!validation.success) {
      return { status: 400, message: 'Datos inválidos', errors: validation.error.errors };
    }
    const numeroDictamenLimpio = (body.numeroDictamen || '').trim().toUpperCase();
    const estadoBody = (body.estado || '').trim();
    if (!numeroDictamenLimpio && estadoBody !== 'procesando') {
      return { status: 400, message: 'Número de dictamen es requerido cuando el estado no es procesando' };
    }
    if (numeroDictamenLimpio) {
      const anioActual = new Date().getFullYear();
      const existeDuplicado = await storage.checkExperticiaDuplicada(numeroDictamenLimpio, anioActual);
      if (existeDuplicado) {
        return { status: 400, message: `Ya existe una experticia con el número de dictamen ${numeroDictamenLimpio} para el año ${anioActual}` };
      }
    }
    return null;
  }

  // POST /api/experticias/validate - Pre-validar datos sin crear nada en BD
  app.post("/api/experticias/validate", authenticateToken, async (req: any, res) => {
    try {
      console.error('[VALIDATE DEBUG] Body recibido:', JSON.stringify({
        numeroDictamen: req.body?.numeroDictamen,
        estado: req.body?.estado,
        operador: req.body?.operador,
        experto: req.body?.experto,
        numeroComunicacion: req.body?.numeroComunicacion,
        motivo: req.body?.motivo,
        tipoExperticia: req.body?.tipoExperticia,
        expediente: req.body?.expediente,
      }, null, 2));

      const error = await validarDatosExperticia(req.body, req.user);

      if (error) {
        console.error('[VALIDATE DEBUG] Errores de validación:', JSON.stringify(error.errors ?? error.message, null, 2));
        return res.status(error.status).json({ message: error.message, errors: error.errors });
      }

      return res.json({ valid: true });
    } catch (err) {
      console.error('[VALIDATE DEBUG] Excepción inesperada:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // POST /api/experticias - Create new experticia
  app.post("/api/experticias", authenticateToken, async (req: any, res) => {
    try {
      const listaResumen = Array.isArray(req.body.listaAnalisis) ? req.body.listaAnalisis : [];
      const totalFilas = listaResumen.reduce((acc: number, item: any) => acc + (item.resultados?.contactos?.datosCrudos?.length ?? 0), 0);

      // Reutilizar la misma validación del endpoint /validate (defensa en profundidad)
      const error = await validarDatosExperticia(req.body, req.user);
      if (error) return res.status(error.status).json({ message: error.message, errors: error.errors });

      const validation = insertExperticiasSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.errors 
        });
      }

      const experticia = await storage.createExperticia({
        ...validation.data,
        usuarioId: req.user.id,
      });

      // ── Normalizar registros de comunicación desde listaAnalisis ─────────
      // Si el frontend envió listaAnalisis (modo Multi-Target con datos crudos),
      // se insertan filas individuales en registros_comunicacion en lugar de
      // quedar atrapados dentro del JSONB de la experticia.
      const listaAnalisis: any[] = Array.isArray(req.body.listaAnalisis)
        ? req.body.listaAnalisis
        : [];

      console.log(`[EXPERTICIA ${experticia.id}] listaAnalisis recibida: ${listaAnalisis.length} item(s)`);

      if (listaAnalisis.length > 0) {
        try {
          const mapearFila = (row: any, numeroOrigen: string, archivoNombre: string): any => ({
            abonadoA: row["ABONADO A"] || row["abonado_a"] || row["AbonadoA"] || numeroOrigen,
            abonadoB: row["ABONADO B"] || row["abonado_b"] || row["AbonadoB"] || "",
            tipoTransaccion: row["Tipo Transacción"] || row["TIPO DE TRANSACCION"] || row["tipo_de_transaccion"] || row["TipoTransaccion"] || "",
            fecha: row["Fecha"] || row["FECHA"] || row["fecha"] || "",
            hora: row["Hora"] || row["HORA"] || row["hora"] || "",
            time: row["Time"] || row["TIME"] || row["SEG"] || row["seg"] || row["segundos"] || null,
            btsCeldaA: row["BTS-Celda A"] || row["bts_celda_a"] || row["BTS_CELDA_A"] || "",
            btsCeldaB: row["BTS-Celda B"] || row["bts_celda_b"] || row["BTS_CELDA_B"] || "",
            direccionA: row["Dirección A"] || row["DIRECCION A"] || row["direccion_a"] || row["Atena"] || row["DIRECCION"] || "",
            direccionB: row["Dirección B"] || row["DIRECCION B"] || row["direccion_b"] || "",
            coordenadasA: row["Coordenadas A"] || row["coordenadas_a"] || row["LATITUD CELDAD INICIO A"] || "",
            coordenadasB: row["Coordenadas B"] || row["coordenadas_b"] || "",
            orientacionA: row["Orientación A"] || row["orientacion_a"] || row["ORIENTACION A"] || "",
            orientacionB: row["Orientación B"] || row["orientacion_b"] || row["ORIENTACION B"] || "",
            imeiA: row["IMEI A"] || row["imei_a"] || row["IMEI ABONADO A"] || row["imei_abonado_a"] || "",
            imeiB: row["IMEI B"] || row["imei_b"] || row["IMEI ABONADO B"] || row["imei_abonado_b"] || "",
            archivo: archivoNombre || "",
            peso: "",
          });

          for (const item of listaAnalisis) {
            const numero: string = item.numero?.trim() || "";
            const datosCrudos: any[] = item.resultados?.contactos?.datosCrudos ?? [];

            console.log(`[EXPERTICIA ${experticia.id}] Item → numero="${numero}" datosCrudos=${datosCrudos.length} fila(s)`);

            if (!numero || datosCrudos.length === 0) {
              console.log(`[EXPERTICIA ${experticia.id}] Saltando item: numero vacío=${!numero} datosCrudos vacíos=${datosCrudos.length === 0}`);
              continue;
            }

            // Registrar SOLO el número analizado en persona_telefonos.
            // Los interlocutores (abonadoB) se guardan como texto en la columna
            // abonado_b de registros_comunicacion; no se catalogan aquí.
            // Upsert atómico: crea si no existe, devuelve el existente si ya hay uno.
            // Imposible crear duplicados gracias al UNIQUE constraint en persona_telefonos.numero.
            const telAnalizado = await storage.upsertPersonaTelefono({
              numero,
              tipo: "móvil",
              activo: true,
              personaId: null,
            });
            console.log(`[EXPERTICIA ${experticia.id}] persona_telefono upsert → id=${telAnalizado.id} para numero="${numero}"`);
            const abonadoAId = telAnalizado.id;

            // Usar el expediente_sujeto_id capturado directamente en el frontend
            // durante el PASO 1 (al crear persona/caso). Esto evita la re-consulta
            // por telefono+expediente que era ambigua en caso de duplicados.
            const expedienteSujetoId: number | null =
              typeof item.expedienteSujetoId === "number" ? item.expedienteSujetoId : null;
            console.log(`[EXPERTICIA ${experticia.id}] expediente_sujeto_id=${expedienteSujetoId ?? "null"} para teléfono="${numero}" (capturado en creación)`);

            // Mapear cada fila al formato de registros_comunicacion
            const filasMapeadas = datosCrudos
              .map((row: any) => {
                const mapped = mapearFila(row, numero, item.archivoNombre || "");
                mapped.experticiaId = experticia.id;
                mapped.abonadoAId = abonadoAId;
                mapped.expedienteSujetoId = expedienteSujetoId;
                mapped.usuarioId = req.user.id;
                return mapped;
              })
              .filter((r: any) => r.abonadoA?.trim());

            console.log(`[EXPERTICIA ${experticia.id}] Filas mapeadas válidas: ${filasMapeadas.length}`);

            if (filasMapeadas.length > 0) {
              await storage.createRegistrosComunicacionBulk(filasMapeadas);
              console.log(`[EXPERTICIA ${experticia.id}] registros_comunicacion insertados: ${filasMapeadas.length}`);
            }
          }
        } catch (normError: any) {
          // No abortar la respuesta: la experticia ya fue creada.
          // El error se registra para diagnóstico.
          console.error(`[EXPERTICIA] Error normalizando registros de comunicación: ${normError?.message}`, normError?.stack);
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Intentar generar automáticamente el documento Word de experticia
      try {
        const plantilla = await storage.getPlantillaWordByTipoExperticiaTipoPlantilla(
          experticia.tipoExperticia, 
          "experticia"
        );
        // Borrar Inesecesario
        if (plantilla && existsSync(plantilla.archivo)) {
          console.log(`✅ Plantilla de experticia encontrada para ${experticia.tipoExperticia}`);
          // La generación del documento se manejará en el frontend
        } else {
          console.log(`⚠️ No se encontró plantilla de experticia para ${experticia.tipoExperticia}`);
        }
      } catch (error) {
        console.log("Error verificando plantilla de experticia:", error);
      }

      res.status(201).json(experticia);

      logger.actividad({
        usuarioId: req.user.id,
        username: req.user.username,
        accion: "experticia_create_analizar",
        modulo: "Experticias",
        resultado: "exitoso",
        ip: (req as any).clientIp,
        detalle: `Dictamen N° ${experticia.numeroDictamen}`,
        metadata: { experticia_id: experticia.id, numero_dictamen: experticia.numeroDictamen, filas: totalFilas },
      });
    } catch (error: any) {
      logger.error({ servicio: "Node", endpoint: "POST /api/experticias", mensaje: String(error.message || error) });
      console.error("Error creating experticia:", error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ message: "Ya existe una experticia con ese código" });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // PUT /api/experticias/:id - Update experticia
  app.put("/api/experticias/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.rol !== 'admin' && req.user.rol !== 'supervisor') {
        return res.status(403).json({ message: "No tienes permisos para editar experticias" });
      }

      const id = parseInt(req.params.id);
      const validation = insertExperticiasSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.errors 
        });
      }

      // Si se está cambiando el numeroDictamen, verificar duplicado por número + año del registro
      if (validation.data.numeroDictamen) {
        const numeroDictamenLimpio = validation.data.numeroDictamen.trim().toUpperCase();
        const existente = await storage.getExperticia(id);
        if (!existente) {
          return res.status(404).json({ message: "Experticia no encontrada" });
        }
        const anioRegistro = new Date(existente.createdAt!).getFullYear();
        const existeDuplicado = await storage.checkExperticiaDuplicada(numeroDictamenLimpio, anioRegistro, id);
        if (existeDuplicado) {
          return res.status(400).json({ message: `Ya existe una experticia con el número de dictamen ${numeroDictamenLimpio} para el año ${anioRegistro}` });
        }
      }

      const experticia = await storage.updateExperticia(id, validation.data);
      
      if (!experticia) {
        return res.status(404).json({ message: "Experticia no encontrada" });
      }

      res.json(experticia);
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ message: "Ya existe una experticia con ese código" });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // PUT /api/experticias/:id/datos-seleccionados - Guardar datos seleccionados
  app.put("/api/experticias/:id/datos-seleccionados", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { datosSeleccionados } = req.body;
      
      if (!datosSeleccionados) {
        return res.status(400).json({ message: "Datos seleccionados son requeridos" });
      }

      const experticia = await storage.updateExperticia(id, { 
        datosSeleccionados: datosSeleccionados 
      });
      
      if (!experticia) {
        return res.status(404).json({ message: "Experticia no encontrada" });
      }

      res.json({ message: "Datos seleccionados guardados exitosamente", experticia });
    } catch (error) {
      console.error("Error guardando datos seleccionados:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // DELETE /api/experticias/:id - Delete experticia
  app.delete("/api/experticias/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.rol !== 'admin' && req.user.rol !== 'supervisor') {
        return res.status(403).json({ message: "No tienes permisos para eliminar experticias" });
      }

      const id = parseInt(req.params.id);
      const success = await storage.deleteExperticia(id);
      
      if (!success) {
        return res.status(404).json({ message: "Experticia no encontrada" });
      }

      res.json({ message: "Experticia eliminada exitosamente" });
    } catch (error) {
      console.error("Error deleting experticia:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // GET /api/personas-casos/by-abonado/:abonado - Obtener datos afiliado por número de abonado
  app.get("/api/personas-casos/by-abonado/:abonado", authenticateToken, async (req: any, res) => {
    try {
      const { abonado } = req.params;
      const persona = await storage.getPersonaCasoByTelefono(abonado);
      if (!persona) {
        return res.status(404).json({ message: "No se encontraron datos del afiliado" });
      }
      const exps = await storage.getExpedientesSujetosByPersonaId(persona.nro);
      const expConTelefono = exps.find((e: any) => e.telefonoCaso === abonado) || exps[0];
      res.json({
        ...persona,
        correo: expConTelefono?.correo ?? null,
        otrosTlf: expConTelefono?.otrosTlf ?? null,
        rol: expConTelefono?.rol ?? null,
        pseudonimo: expConTelefono?.pseudonimo ?? null,
        expediente: expConTelefono?.expediente ?? null,
      });
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // POST /api/personas-casos/by-abonado/:abonado - Crear o actualizar datos afiliado por número de abonado
  app.post("/api/personas-casos/by-abonado/:abonado", authenticateToken, async (req: any, res) => {
    try {
      const { abonado } = req.params;
      const { cedula, nombre, apellido, pseudonimo, fechaDeNacimiento, correo, direccion, expediente, otrosTlf, rol } = req.body;
      const persona = await storage.upsertPersonaCasoByAbonado(abonado, {
        cedula: cedula || null,
        nombre: nombre || null,
        apellido: apellido || null,
        fechaDeNacimiento: fechaDeNacimiento || null,
        direccion: direccion || null,
      });

      // Si viene un expediente, correo, otrosTlf o rol, actualizar el expedienteSujeto correspondiente
      if (expediente || correo || otrosTlf || rol) {
        const exps = await storage.getExpedientesSujetosByPersonaId(persona.nro);
        const expConTelefono = exps.find((e: any) => e.telefonoCaso === abonado);
        if (expConTelefono) {
          await storage.updateExpedienteSujeto(expConTelefono.id, {
            ...(expediente ? { expediente } : {}),
            pseudonimo: pseudonimo || expConTelefono.pseudonimo || undefined,
            ...(correo ? { correo } : {}),
            ...(otrosTlf ? { otrosTlf } : {}),
            ...(rol ? { rol } : {}),
          });
        }
      }

      res.json(persona);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Ruta para generar archivo Excel con datos de experticia
  app.post("/api/experticias/generate-excel", authenticateToken, async (req: any, res) => {
    try {
      const requestData = req.body;
      console.log("=== INICIO GENERACIÓN EXCEL EXPERTICIA ===");
      console.log("Datos de experticia recibidos:", JSON.stringify(requestData, null, 2));
      
      // Verificar que existe la plantilla Excel
      const excelTemplatePath = path.join(process.cwd(), 'uploads', 'PLANILLA DATOS.xlsx');
      console.log("Buscando plantilla en:", excelTemplatePath);
      if (!existsSync(excelTemplatePath)) {
        console.log("Plantilla Excel no encontrada");
        return res.status(404).json({ message: "Plantilla Excel no encontrada" });
      }

      // Preparar datos para la plantilla
      const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const dictamenShort = requestData.numeroDictamen?.split('-').pop() || requestData.numeroDictamen || '';
      
      // Leer la plantilla Excel con ExcelJS para preservar formato
      console.log("Leyendo plantilla Excel con ExcelJS...");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(excelTemplatePath);
      const worksheet = workbook.getWorksheet(1); // Primera hoja
      
      if (!worksheet) {
        console.log("No se pudo acceder a la hoja de trabajo");
        return res.status(500).json({ message: "Error accediendo a la hoja de trabajo Excel" });
      }
      
      // Generar mapeo de datos específico para experticias
      const dataMappings = [
        {
          'B2': dictamenShort,                      // {DICTAMEN}
          'C2': currentDate,                        // {FECHA}
          'D2': 'Departamento de Experticias',      // Oficina
          'E2': requestData.expediente || '',       // {EXP} - Expediente
          'F2': requestData.abonado || '',          // {abonado} - Información del abonado
          'G2': requestData.fechaComunicacion || '', // {desde} - Fecha comunicación
          'H2': requestData.fechaRespuesta || '',   // {F.RR} - Fecha respuesta
          'J2': requestData.motivo || '',           // Motivo
          'K2': requestData.experto || '',          // {EXPERTO}
        }
      ];

      // Aplicar los datos a las celdas preservando el formato
      dataMappings.forEach((dataMapping: Record<string, string>) => {
        Object.entries(dataMapping).forEach(([cellAddress, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            const cell = worksheet.getCell(cellAddress);
            cell.value = String(value);
            // El formato y estilo de la celda se preserva automáticamente
          }
        });
      });

      // Generar el buffer del archivo Excel modificado
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const excelBuffer = Buffer.from(arrayBuffer);

      // Configurar respuesta para descarga
      const customFileName = `EXPERTICIA_DATOS-${requestData.numeroDictamen || 'experticia'}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${customFileName}"`);
      res.send(excelBuffer);

    } catch (error) {
      res.status(500).json({ message: "Error generando archivo Excel de experticia" });
    }
  });

  const combinarUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos Excel (.xls, .xlsx)') as any, false);
      }
    }
  });

  app.post("/api/experticias/combinar-excel", combinarUpload.any(), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length < 2) {
        return res.status(400).json({ message: "Debes seleccionar al menos 2 archivos para combinar" });
      }

      const workbookCombinado = new ExcelJS.Workbook();
      const worksheetCombinado = workbookCombinado.addWorksheet('Datos Combinados');

      let primeraHoja = true;

      for (const file of files) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) continue;

        const filas = worksheet.getRows(1, worksheet.rowCount) || [];
        if (!Array.isArray(filas)) return; // O manejar el error

        filas.forEach((fila, index) => {
          if (!fila) return; // Evita errores si alguna fila es undefined
          if (!primeraHoja && index === 0) return;

          const nuevaFila = worksheetCombinado.addRow([]);
          fila.eachCell((celda, colNumber) => {
            nuevaFila.getCell(colNumber).value = celda.value;
          });
        });

        primeraHoja = false;
      }

      const buffer = await workbookCombinado.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="archivos_combinados.xlsx"');
      res.send(Buffer.from(buffer));

    } catch (error) {
      console.error("Error combinando archivos Excel:", error);
      res.status(500).json({ message: "Error combinando archivos Excel" });
    }
  });
}