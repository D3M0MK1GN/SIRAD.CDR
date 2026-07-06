import { type Experticia } from "@shared/schema";

/**
 * VALIDACIÓN DE TECLADO
 * Define qué teclas se permiten en campos de entrada
 */

// Teclas especiales permitidas (navegación, borrado, etc.)
export const ALLOWED_KEYS = [
  "Backspace", "Delete", "Tab", "Enter",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Home", "End",
];

// Patrones regex para validar caracteres en inputs
// numeric: solo números (0-9)
// dateTime: números, barras y guiones (para fechas)
// time: números y dos puntos (para horas)
export const CHAR_PATTERNS = {
  numeric: /[0-9]/,
  dateTime: /[0-9\/\-\s]/,
  time: /[0-9:]/,
} as const;

/**
 * Valida el keydown en inputs de fecha/hora
 * Previene que se escriban caracteres no permitidos
 */
export const handleDateInputKeyDown = (
  e: React.KeyboardEvent<HTMLInputElement>,
  pattern: RegExp
) => {
  if (ALLOWED_KEYS.includes(e.key)) return; // Permitir teclas especiales
  if (!pattern.test(e.key)) e.preventDefault(); // Bloquear otros caracteres
};

/**
 * FORMATEO DE DATOS
 * Convierte valores internos a etiquetas legibles para el usuario
 */

// Convierte código de operador a nombre completo
export const formatOperator = (operador?: string) => {
  const names: Record<string, string> = {
    digitel: "Digitel",
    movistar: "Movistar",
    movilnet: "Movilnet",
  };
  return (operador && names[operador]) || operador || "N/A";
};

// Convierte código de estado a etiqueta descriptiva
export const formatStatus = (estado?: string | null) => {
  if (!estado) return "N/A";
  const names: Record<string, string> = {
    completada: "Completada",
    procesando: "Procesando",
    qr_ausente: "QR Ausente",
  };
  return names[estado] || estado;
};

/**
 * PROCESAMIENTO DE DATOS BTS
 * Extrae y normaliza filas seleccionadas de resultados de análisis
 */
export const extractSelectedRows = (
  results: any[],
  selectedIndices: Set<number>
): any[] => {
  const selected: any[] = [];
  selectedIndices.forEach((index) => {
    const row = results[index];
    if (row) {
      // Normaliza nombres de columnas a formato estándar (maneja variaciones)
      selected.push({
        ABONADO_A: row["ABONADO A"] || row.ABONADO_A || "",
        ABONADO_B: row["ABONADO B"] || row.ABONADO_B || "",
        FECHA: row.FECHA || "",
        HORA: row.HORA || "",
        TIME: row.TIME || "",
        DIRECCION: row.DIRECCION || "",
        CORDENADAS: row.CORDENADAS || "",
      });
    }
  });
  return selected;
};

/**
 * DESCARGAS DE ARCHIVOS
 * Función genérica para descargar documentos desde el servidor
 */
export const downloadFile = async (
  url: string,
  filename: string,
  options: { authorization?: string; body?: any } = {}
) => {
  try {
    // Realiza petición POST al servidor
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.authorization && {
          Authorization: options.authorization,
        }),
      },
      ...(options.body !== undefined && {
        body: JSON.stringify(options.body),
      }),
    });

    if (!response.ok) throw new Error("Error descargando archivo");

    // Convierte respuesta a blob y descarga automáticamente
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(objectUrl);
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error en descarga:", error);
    throw error;
  }
};

/**
 * ESTILOS Y COLORES
 * Mapeo de estados/operadores a clases Tailwind para badges
 */

// Clases Tailwind para badges de estado
// Se aplican según el valor de estado de cada experticia
export const STATUS_COLORS: Record<string, string> = {
  completada: "bg-green-100 text-green-800",
  procesando: "bg-yellow-100 text-yellow-800",
  qr_ausente: "bg-orange-100 text-orange-800",
};

// Clases Tailwind para badges de operador
// Se aplican según la compañía telefónica
export const OPERATOR_COLORS: Record<string, string> = {
  digitel: "bg-red-100 text-red-800",
  movistar: "bg-blue-100 text-blue-800",
  movilnet: "bg-green-100 text-green-800",
};

/**
 * CATÁLOGOS DE DATOS
 * Opciones disponibles para selects en formularios
 */

// Tipos de experticia disponibles (especialidades de análisis)
export const EXPERTICIA_TYPES = [
  { id: "identificar_datos_numero", label: "Identificar datos de un número" },
  { id: "determinar_historicos_trazas_bts", label: "Determinar Históricos de Trazas Telefónicas BTS" },
  { id: "determinar_linea_conexion_ip", label: "Determinar línea telefónica con conexión IP" },
  { id: "identificar_radio_bases_bts", label: "Identificar las Radio Bases (BTS)" },
  { id: "identificar_numeros_duraciones_bts", label: "Identificar números con duraciones específicas en la Radio Base (BTS)" },
  { id: "determinar_contaminacion_linea", label: "Determinar contaminación de línea" },
  { id: "determinar_sim_cards_numero", label: "Determinar SIM CARDS utilizados con un número telefónico" },
  { id: "determinar_comportamiento_social", label: "Determinar comportamiento social" },
  { id: "determinar_contacto_frecuente", label: "Determinar Contacto Frecuente" },
  { id: "determinar_ubicacion_llamadas", label: "Determinar ubicación mediante registros de llamadas" },
  { id: "determinar_ubicacion_trazas", label: "Determinar ubicación mediante registros de trazas telefónicas (Recorrido)" },
  { id: "determinar_contaminacion_equipo_imei", label: "Determinar contaminación de equipo (IMEI)" },
  { id: "identificar_numeros_comun_bts", label: "Identificar números en común en dos o más Radio Base (BTS)" },
  { id: "identificar_numeros_desconectan_bts", label: "Identificar números que se desconectan de la Radio Base (BTS) después del hecho" },
  { id: "identificar_numeros_repetidos_bts", label: "Identificar números repetidos en la Radio Base (BTS)" },
  { id: "determinar_numero_internacional", label: "Determinar número internacional" },
  { id: "identificar_linea_sim_card", label: "Identificar línea mediante SIM CARD" },
  { id: "identificar_cambio_simcard_documentos", label: "Identificar Cambio de SIM CARD y Documentos" },
];

// Operadores telefónicos disponibles
export const OPERATORS = [
  { id: "digitel", label: "Digitel" },
  { id: "movistar", label: "Movistar" },
  { id: "movilnet", label: "Movilnet" },
];

// Estados posibles de una experticia
export const STATUSES = [
  { id: "completada", label: "Completada" },
  { id: "procesando", label: "Procesando" },
  { id: "qr_ausente", label: "QR Ausente" },
];
