import { useForm, useWatch, Control } from "react-hook-form";
import { useRef, useState, useEffect, useMemo, useCallback, memo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Atom,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Clipboard,
  Check,
  Search,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { Badge } from "@/components/ui/badge";
import { insertExperticiasSchema, type Experticia } from "@shared/schema";
import { usePermissions } from "@/hooks/use-permissions";
import {
  OPERATORS,
  STATUSES,
  EXPERTICIA_TYPES,
  ALLOWED_KEYS,
  CHAR_PATTERNS,
  handleDateInputKeyDown,
  extractSelectedRows,
} from "@/lib/experticia-utils";
import { z } from "zod";

// Esquema de validación para el formulario de experticias
// Extiende el esquema base con un campo createdAt opcional
const experticiasFormSchema = insertExperticiasSchema.extend({
  createdAt: z.string().optional(),
});

// Tipo de datos del formulario (inferido del esquema Zod)
type FormData = z.infer<typeof experticiasFormSchema>;

/**
 * Props para el componente ExperticiasForm
 * @property experticia - Experticia a editar (si es null, es modo creación; si id es undefined, es modo duplicación)
 * @property onSubmit - Callback cuando se envía el formulario
 * @property onCancel - Callback para cancelar y cerrar el formulario
 * @property isLoading - Indica si hay operación en curso (deshabilita botón submit)
 * @property preloadData - Datos precargados para inicializar campos
 */
interface ExperticiasFormProps {
  experticia?: Experticia | null;
  onSubmit: (data: FormData) => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
  preloadData?: Partial<FormData> | null;
}

// ─── Subcomponente: Tabla BTS ────────────────────────────────────────────────
interface TablaBTSProps {
  isAnalyzing: boolean;
  results: any[] | null;
  error: string | null;
  selectedRows: Set<number>;
  copiedTable: string | null;
  onCopiar: (tableId: string, filas: any[], columnas: string[]) => void;
  onVerTabla: () => void;
  abonadoValue: string;
}

const TablaBTS = memo(function TablaBTS({ isAnalyzing, results, error, selectedRows, copiedTable, onCopiar, onVerTabla, abonadoValue }: TablaBTSProps) {
  if (!isAnalyzing && !results && !error) return null;
  return (
    <div className="space-y-3 border-t pt-4">
      <h4 className="text-md font-medium">Análisis BTS</h4>
      {isAnalyzing && (
        <div className="flex items-center space-x-2 text-sm text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analizando archivo BTS...</span>
        </div>
      )}
      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      {results && results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-600 font-medium">
              Resultados encontrados: {results.length}
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm"
                onClick={() => onCopiar('bts', results, ['ABONADO A', 'ABONADO B', 'FECHA', 'HORA', 'TIME', 'DIRECCION', 'CORDENADAS'])}
                title="Copiar tabla">
                {copiedTable === 'bts' ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onVerTabla} title="Ver tabla completa">
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ABONADO A</TableHead>
                  <TableHead>ABONADO B</TableHead>
                  <TableHead>FECHA</TableHead>
                  <TableHead>HORA</TableHead>
                  <TableHead>TIME</TableHead>
                  <TableHead>DIRECCION</TableHead>
                  <TableHead>CORDENADAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index} className={selectedRows.has(index) ? "bg-blue-100 dark:bg-blue-900/40" : ""}>
                    <TableCell className="py-1 px-2 text-xs">{result["ABONADO A"] || result["ABONADO_A"] || "-"}</TableCell>
                    <TableCell className="py-1 px-2 text-xs">{result["ABONADO B"] || result["ABONADO_B"] || "-"}</TableCell>
                    <TableCell className="py-1 px-2 text-xs">{result["FECHA"] || "-"}</TableCell>
                    <TableCell className="py-1 px-2 text-xs">{result["HORA"] || "-"}</TableCell>
                    <TableCell className="py-1 px-2 text-xs">{result["TIME"] || "-"}</TableCell>
                    <TableCell className="py-1 px-2 text-xs">{result["DIRECCION"] || "-"}</TableCell>
                    <TableCell className="py-1 px-2 text-xs">{result["CORDENADAS"] || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {results && results.length === 0 && (
        <div className="text-sm text-gray-600">
          No se encontraron resultados para el número {abonadoValue}
        </div>
      )}
    </div>
  );
});

// ─── Subcomponente: Tabla Contactos Frecuentes ───────────────────────────────
interface TablaContactosFrecuentesProps {
  state: { isAnalyzing: boolean; datosCrudos: any[] | null; todosLosContactos: any[] | null; imeisUtilizados: any[] | null; error: string | null };
  limitContactos: number | 'todos';
  onSetLimitContactos: (v: number | 'todos') => void;
  copiedTable: string | null;
  onCopiar: (tableId: string, filas: any[], columnas: string[]) => void;
  onVerDatosCrudos: () => void;
  onVerContactos: () => void;
  tiposColumnas: string[];
  totales: { visibles: any[]; totalFrecuencia: number; primeraFecha: string; ultimaFecha: string; sumasPorTipo: Record<string, number> } | null;
  abonadoValue: string;
  numeroSeleccionado?: string;
}

const TablaContactosFrecuentes = memo(function TablaContactosFrecuentes({ state, limitContactos, onSetLimitContactos, copiedTable, onCopiar, onVerDatosCrudos, onVerContactos, tiposColumnas, totales, abonadoValue, numeroSeleccionado }: TablaContactosFrecuentesProps) {
  if (!state.isAnalyzing && !state.datosCrudos && !state.todosLosContactos && !state.error) return null;

  const exportarExcel = async () => {
    const wb = new ExcelJS.Workbook();

    const HEADER_FILL: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0BD1F7' },
    };

    const THIN_BORDER: Partial<ExcelJS.Borders> = {
      top:    { style: 'thin', color: { argb: 'FF000000' } },
      left:   { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right:  { style: 'thin', color: { argb: 'FF000000' } },
    };

    const numeroEstudiado = (numeroSeleccionado ?? abonadoValue ?? '').toString().trim();

    const styleHeaderRow = (row: ExcelJS.Row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = HEADER_FILL;
        cell.font = { bold: true, color: { argb: 'FF000000' } };
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      row.height = 20;
    };

    const styleDataRow = (row: ExcelJS.Row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = THIN_BORDER;
        const cellVal = (cell.value ?? '').toString().trim();
        if (numeroEstudiado && cellVal === numeroEstudiado) {
          cell.font = { color: { argb: 'FFFF0000' }, bold: true };
        }
      });
    };

    const autoFitColumns = (ws: ExcelJS.Worksheet, headers: string[]) => {
      ws.columns.forEach((col, i) => {
        if (!col) return;
        let maxLen = (headers[i] ?? '').length;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const len = (cell.value ?? '').toString().length;
          if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(maxLen + 4, 45);
      });
    };

    const addSheet = (name: string, headers: string[], filas: Record<string, any>[]) => {
      const ws = wb.addWorksheet(name);
      ws.addRow(headers);
      styleHeaderRow(ws.getRow(1));
      filas.forEach((rowData, i) => {
        const values = headers.map((h) => rowData[h] ?? '');
        ws.addRow(values);
        styleDataRow(ws.getRow(i + 2));
      });
      autoFitColumns(ws, headers);
    };

    if (state.todosLosContactos && state.todosLosContactos.length > 0) {
      const headers = ['#', 'INTERLOCUTOR', ...tiposColumnas, 'TOTAL GENERAL', 'PRIMERA FECHA', 'ULTIMA FECHA'];
      const filas = state.todosLosContactos.map((c: any, i: number) => {
        const fila: Record<string, any> = { '#': i + 1, INTERLOCUTOR: c.numero || c.NUMERO || '' };
        tiposColumnas.forEach((tipo) => { fila[tipo] = c[tipo] ?? 0; });
        fila['TOTAL GENERAL'] = c.frecuencia ?? c.FRECUENCIA ?? 0;
        fila['PRIMERA FECHA'] = c.primera_fecha ?? c.PRIMERA_FECHA ?? '';
        fila['ULTIMA FECHA'] = c.ultima_fecha ?? c.ULTIMA_FECHA ?? '';
        return fila;
      });
      addSheet('Contactos Frecuentes', headers, filas);
    }

    if (state.datosCrudos && state.datosCrudos.length > 0) {
      const headers = Object.keys(state.datosCrudos[0]);
      addSheet('Datos de Comunicacion', headers, state.datosCrudos);
    }

    if (state.imeisUtilizados && state.imeisUtilizados.length > 0) {
      const headers = ['NUMERO ESTUDIADO', 'IMEI', 'CANTIDAD DE USOS'];
      const filas = state.imeisUtilizados
        .filter((item: any) => {
          const imeiNum = parseFloat(item.imei);
          return !isNaN(imeiNum) && imeiNum !== 0;
        })
        .map((item: any) => ({
          'NUMERO ESTUDIADO': item.numero,
          'IMEI': Math.round(parseFloat(item.imei)).toString(),
          'CANTIDAD DE USOS': item.cantidad,
        }));
      if (filas.length > 0) addSheet('IMEI', headers, filas);
    }

    if (state.datosCrudos && state.datosCrudos.length > 0) {
      const parseCoordenadas = (coord: string): { lat: number; lon: number } | null => {
        const parts = coord.split(',').map((s: string) => s.trim());
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon) && !(lat === 0 && lon === 0)) return { lat, lon };
        }
        return null;
      };

      const invalidos = new Set(['', '-', 'n/d', 'nan', 'none', 'n/d, n/d', 'nan, nan']);

      const antenaMap = new Map<string, {
        totalFisica: number;
        coordenadas: string;
        celdas: Map<string, { frecuencia: number; direccion: string; orientacion: string }>;
      }>();

      for (const row of state.datosCrudos) {
        const abonadoA = (row['ABONADO A'] ?? '').toString().trim();
        const abonadoB = (row['ABONADO B'] ?? '').toString().trim();

        let coordStr = '';
        let btsCelda = '';
        let direccion = '';
        let orientacion = '-';

        if (abonadoA === numeroEstudiado) {
          coordStr    = (row['Coordenadas A'] ?? '').toString().trim();
          btsCelda    = (row['BTS-Celda A']   ?? '').toString().trim();
          direccion   = (row['Dirección A']   ?? '').toString().trim();
          orientacion = (row['Orientación A'] ?? '-').toString().trim() || '-';
        } else if (abonadoB === numeroEstudiado) {
          coordStr    = (row['Coordenadas B'] ?? '').toString().trim();
          btsCelda    = (row['BTS-Celda B']   ?? '').toString().trim();
          direccion   = (row['Dirección B']   ?? '').toString().trim();
          orientacion = (row['Orientación B'] ?? '-').toString().trim() || '-';
        } else {
          continue;
        }

        if (invalidos.has(coordStr.toLowerCase())) continue;
        const parsed = parseCoordenadas(coordStr);
        if (!parsed) continue;

        const coordKey = `${parsed.lat},${parsed.lon}`;
        if (!antenaMap.has(coordKey)) {
          antenaMap.set(coordKey, { totalFisica: 0, coordenadas: coordStr, celdas: new Map() });
        }
        const antena = antenaMap.get(coordKey)!;
        antena.totalFisica++;
        if (btsCelda) {
          if (!antena.celdas.has(btsCelda)) {
            antena.celdas.set(btsCelda, { frecuencia: 0, direccion, orientacion });
          }
          antena.celdas.get(btsCelda)!.frecuencia++;
        }
      }

      if (antenaMap.size > 0) {
        const geoHeaders = ['Frec. Total Física', 'Frec. por Celda', 'BTS-Celda', 'Dirección', 'Coordenadas (Lat, Lon)', 'Orientación'];
        const filasGeo: Record<string, any>[] = [];
        const antenasSorted = [...antenaMap.entries()].sort((a, b) => b[1].totalFisica - a[1].totalFisica);

        for (const [, antena] of antenasSorted) {
          const celdasSorted = [...antena.celdas.entries()].sort((a, b) => b[1].frecuencia - a[1].frecuencia);
          let primera = true;
          for (const [btsCelda, celda] of celdasSorted) {
            filasGeo.push({
              'Frec. Total Física': primera ? antena.totalFisica : '',
              'Frec. por Celda': celda.frecuencia,
              'BTS-Celda': btsCelda,
              'Dirección': celda.direccion,
              'Coordenadas (Lat, Lon)': antena.coordenadas,
              'Orientación': celda.orientacion,
            });
            primera = false;
          }
        }

        if (filasGeo.length > 0) {
          addSheet('Georreferenciación', geoHeaders, filasGeo);
        }
      }
    }

    const nombreBase = numeroSeleccionado || abonadoValue;
    const nombre = nombreBase ? `Contactos_Frecuentes_${nombreBase}.xlsx` : 'Contactos_Frecuentes.xlsx';

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-4 border-t pt-4">
      <h4 className="text-md font-medium">Análisis de Contactos Frecuentes</h4>
      {state.isAnalyzing && (
        <div className="flex items-center space-x-2 text-sm text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analizando contactos frecuentes...</span>
        </div>
      )}
      {state.error && (
        <div className="flex items-center space-x-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" />
          <span>{state.error}</span>
        </div>
      )}
      {state.datosCrudos && state.datosCrudos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-600 font-medium">
              Registros de comunicación: {state.datosCrudos.length}
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm"
                onClick={() => onCopiar('crudos', state.datosCrudos!, Object.keys(state.datosCrudos![0]))}
                title="Copiar tabla">
                {copiedTable === 'crudos' ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onVerDatosCrudos} title="Ver tabla completa">
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {state.datosCrudos.length > 0 && Object.keys(state.datosCrudos[0]).map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.datosCrudos.slice(0, 200).map((row, index) => (
                  <TableRow key={index}>
                    {Object.keys(row).map((col) => (
                      <TableCell key={col} className="py-1 px-2 text-xs">{row[col] || "-"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {state.todosLosContactos && state.todosLosContactos.length > 0 && (
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-blue-700">Contactos Frecuentes</h5>
            <div className="flex items-center gap-1">
              <select value={limitContactos}
                onChange={(e) => onSetLimitContactos(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                title="Cantidad de contactos a mostrar">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value="todos">Todos</option>
              </select>
              <Button type="button" variant="outline" size="sm"
                onClick={() => {
                  if (!totales) return;
                  const { visibles, sumasPorTipo, totalFrecuencia, primeraFecha, ultimaFecha } = totales;
                  const totalFila: any = { NUMERO: 'TOTALES' };
                  tiposColumnas.forEach((tipo) => { totalFila[tipo] = sumasPorTipo[tipo] || 0; });
                  totalFila['frecuencia'] = totalFrecuencia;
                  totalFila['primera_fecha'] = primeraFecha;
                  totalFila['ultima_fecha'] = ultimaFecha;
                  const datosConTotales = [...visibles.map((c: any) => ({ ...c, NUMERO: c.numero })), totalFila];
                  onCopiar('contactos', datosConTotales, ['NUMERO', ...tiposColumnas, 'frecuencia', 'primera_fecha', 'ultima_fecha']);
                }}
                className="flex items-center gap-1 text-xs" title="Copiar tabla">
                {copiedTable === 'contactos' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onVerContactos} className="flex items-center gap-1 text-xs">
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={exportarExcel} className="flex items-center gap-1 text-xs" title="Exportar a Excel">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-lg border-blue-200">
            <Table>
              <TableHeader className="bg-blue-50">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>INTERLOCUTOR</TableHead>
                  {tiposColumnas.map((tipo) => (
                    <TableHead key={tipo} className="text-center text-[10px] leading-tight font-bold text-blue-900">{tipo}</TableHead>
                  ))}
                  <TableHead className="text-center font-bold">TOTAL GENERAL</TableHead>
                  <TableHead>PRIMERA FECHA</TableHead>
                  <TableHead>ULTIMA FECHA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(limitContactos === 'todos' ? state.todosLosContactos : state.todosLosContactos.slice(0, limitContactos)).map((contacto: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="py-1 px-2 text-xs font-bold">{index + 1}</TableCell>
                    <TableCell className="py-1 px-2 text-xs font-mono font-bold">{contacto.numero || contacto.NUMERO || "-"}</TableCell>
                    {tiposColumnas.map((tipo) => (
                      <TableCell key={tipo} className="py-1 px-2 text-xs text-center border-l border-gray-100">
                        {contacto[tipo] > 0 ? <span className="font-medium text-gray-700">{contacto[tipo]}</span> : ""}
                      </TableCell>
                    ))}
                    <TableCell className="py-1 px-2 text-xs text-center font-bold bg-blue-50/30">{contacto.frecuencia || contacto.FRECUENCIA || 0}</TableCell>
                    <TableCell className="py-1 px-2 text-xs text-gray-500">{contacto.primera_fecha || contacto.PRIMERA_FECHA || "-"}</TableCell>
                    <TableCell className="py-1 px-2 text-xs text-gray-500">{contacto.ultima_fecha || contacto.ULTIMA_FECHA || "-"}</TableCell>
                  </TableRow>
                ))}
                {totales && (
                  <TableRow className="bg-blue-900 text-white font-bold border-t-2 border-blue-700">
                    <TableCell className="py-1 px-2 text-xs text-white"></TableCell>
                    <TableCell className="py-1 px-2 text-xs text-white tracking-wide">TOTALES</TableCell>
                    {tiposColumnas.map((tipo) => (
                      <TableCell key={tipo} className="py-1 px-2 text-xs text-center text-white">{totales.sumasPorTipo[tipo] || 0}</TableCell>
                    ))}
                    <TableCell className="py-1 px-2 text-xs text-center text-white">{totales.totalFrecuencia}</TableCell>
                    <TableCell className="py-1 px-2 text-xs text-white">{totales.primeraFecha}</TableCell>
                    <TableCell className="py-1 px-2 text-xs text-white">{totales.ultimaFecha}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {state.datosCrudos && state.datosCrudos.length === 0 && (
        <div className="text-sm text-gray-600">
          No se encontraron registros de comunicación para el número {abonadoValue}
        </div>
      )}
    </div>
  );
});

// ─── Type alias for multi-target analysis item ──────────────────────────────
type AnalisisItem = {
  id: string;
  numero: string;
  archivoNombre: string;
  archivoCrudo: File;
  operador: string;
  resultados: {
    bts?: any[];
    contactos?: {
      datosCrudos: any[];
      top10: any[];
    };
  } | null;
};

// ─── Subcomponente aislado: Input Abonado ────────────────────────────────────
interface AbonadoInputProps {
  control: Control<FormData>;
}

const AbonadoInput = memo(function AbonadoInput({ control }: AbonadoInputProps) {
  return (
    <FormField
      control={control}
      name="abonado"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Abonado</FormLabel>
          <FormControl>
            <Input
              placeholder="Número o identificación del abonado"
              {...field}
              value={field.value || ""}
              onKeyDown={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  const allowedCtrlKeys = ["v","c","x","a","z","y","V","C","X","A","Z","Y"];
                  if (allowedCtrlKeys.includes(e.key)) {
                    return;
                  }
                }
                handleDateInputKeyDown(e, CHAR_PATTERNS.numeric);
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

// ─── Subcomponente contenedor aislado: Sección Análisis Objetivos ─────────────
interface SeccionAnalisisObjetivosProps {
  control: Control<FormData>;
  tipoExperticiaValue: string;
  listaAnalisis: AnalisisItem[];
  setListaAnalisis: React.Dispatch<React.SetStateAction<AnalisisItem[]>>;
  selectedIndex: number | null;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number | null>>;
  agregarAnalisis: (numero: string, file: File, operador: string) => Promise<void>;
  procesarTodosLosAnalisis: () => Promise<void>;
  procesarArchivoAdjuntoDirecto: (numero: string, rutaArchivo: string, operador: string) => Promise<void>;
  fileUploadState: { isUploading: boolean; uploadedFile: { name: string; size: string } | null; error: string | null };
  setFileUploadState: React.Dispatch<React.SetStateAction<{ isUploading: boolean; uploadedFile: { name: string; size: string } | null; error: string | null }>>;
  formatFileSize: (bytes: number) => string;
  getOperador: () => string;
  setFormValue: (name: keyof FormData, value: any) => void;
  btsAnalysisState: { isAnalyzing: boolean; results: any[] | null; error: string | null };
  contactosFrecuentesState: { isAnalyzing: boolean; datosCrudos: any[] | null; todosLosContactos: any[] | null; imeisUtilizados: any[] | null; error: string | null };
  selectedRows: Set<number>;
  copiedTable: string | null;
  copiarAlPortapapeles: (tableId: string, filas: any[], columnas: string[]) => void;
  onVerTabla: () => void;
  onVerDatosCrudos: () => void;
  onVerContactos: () => void;
  limitContactos: number | 'todos';
  setLimitContactos: React.Dispatch<React.SetStateAction<number | 'todos'>>;
  tiposColumnas: string[];
  totales: { visibles: any[]; totalFrecuencia: number; primeraFecha: string; ultimaFecha: string; sumasPorTipo: Record<string, number> } | null;
}

const SeccionAnalisisObjetivos = memo(function SeccionAnalisisObjetivos({
  control,
  tipoExperticiaValue,
  listaAnalisis,
  setListaAnalisis,
  selectedIndex,
  setSelectedIndex,
  agregarAnalisis,
  procesarTodosLosAnalisis,
  procesarArchivoAdjuntoDirecto,
  fileUploadState,
  setFileUploadState,
  formatFileSize,
  getOperador,
  setFormValue,
  btsAnalysisState,
  contactosFrecuentesState,
  selectedRows,
  copiedTable,
  copiarAlPortapapeles,
  onVerTabla,
  onVerDatosCrudos,
  onVerContactos,
  limitContactos,
  setLimitContactos,
  tiposColumnas,
  totales,
}: SeccionAnalisisObjetivosProps) {
  const abonadoValue = useWatch({ control, name: "abonado" });

  return (
    <>
      {/* Campo: Tabla de Multi-Target — solo para Contactos Frecuentes */}
      {tipoExperticiaValue === "determinar_contacto_frecuente" && (
        <div className="space-y-3 border rounded-lg p-3 bg-gray-50 dark:bg-gray-900/20">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tabla de Experticia - Multi-Target
            </h4>
            <div className="flex items-center space-x-2">
              <Input
                type="file"
                className="hidden"
                id="multi-file-upload"
                accept=".xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && abonadoValue) {
                    agregarAnalisis(abonadoValue, file, getOperador());
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() =>
                  document.getElementById("multi-file-upload")?.click()
                }
                disabled={!abonadoValue || listaAnalisis.length >= 10}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {listaAnalisis.length >= 10 ? "Límite Alcanzado" : "Agregar"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={procesarTodosLosAnalisis}
                disabled={
                  listaAnalisis.length === 0 ||
                  btsAnalysisState.isAnalyzing
                }
              >
                {btsAnalysisState.isAnalyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Atom className="h-3.5 w-3.5 mr-1.5" />
                )}
                Analizar Todo
              </Button>
            </div>
          </div>

          {listaAnalisis.length > 0 && (
            <div className="border rounded-md overflow-hidden bg-white dark:bg-black shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b h-8">
                    <TableHead className="h-8 py-1 text-[11px] font-bold uppercase tracking-tight px-3">
                      Número
                    </TableHead>
                    <TableHead className="h-8 py-1 text-[11px] font-bold uppercase tracking-tight px-3">
                      Archivo
                    </TableHead>
                    <TableHead className="h-8 py-1 text-[11px] font-bold uppercase tracking-tight w-[100px] px-3">
                      Estado
                    </TableHead>
                    <TableHead className="h-8 py-1 text-[11px] font-bold uppercase tracking-tight w-[50px] text-center px-3">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaAnalisis.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer transition-colors h-8 border-b last:border-0 ${
                        selectedIndex === index
                          ? "bg-blue-50/80 dark:bg-blue-900/20"
                          : "hover:bg-muted/30"
                      }`}
                      onClick={() => setSelectedIndex(index)}
                    >
                      <TableCell className="py-1 px-3 font-mono text-[11px] font-medium">
                        {item.numero}
                      </TableCell>
                      <TableCell
                        className="py-1 px-3 max-w-[180px] truncate text-[11px] text-muted-foreground"
                        title={item.archivoNombre}
                      >
                        {item.archivoNombre}
                      </TableCell>
                      <TableCell className="py-1 px-3">
                        {item.resultados ? (
                          <Badge
                            variant="outline"
                            className="h-5 px-1.5 py-0 text-[9px] font-bold bg-green-50 text-green-700 border-green-200/50 rounded-full"
                          >
                            <CheckCircle className="h-2.5 w-2.5 mr-1" />{" "}
                            LISTO
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="h-5 px-1.5 py-0 text-[9px] font-bold bg-amber-50 text-amber-700 border-amber-200/50 rounded-full"
                          >
                            PENDIENTE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-1 px-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setListaAnalisis((prev) =>
                              prev.filter((_, i) => i !== index)
                            );
                            if (selectedIndex === index)
                              setSelectedIndex(null);
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Campo: Adjuntar Archivo — solo para tipos distintos a Contactos Frecuentes */}
      {tipoExperticiaValue !== "determinar_contacto_frecuente" && (
        <FormField
          control={control}
          name="archivoAdjunto"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Adjuntar Archivo</span>
              </FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept=".xls,.xlsx"
                    disabled={
                      !abonadoValue ||
                      fileUploadState.isUploading ||
                      listaAnalisis.length > 0
                    }
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFileUploadState({
                          isUploading: true,
                          uploadedFile: null,
                          error: null,
                        });

                        try {
                          const formData = new FormData();
                          formData.append("archivo", file);

                          const response = await fetch(
                            "/api/experticias/upload-archivo",
                            {
                              method: "POST",
                              headers: {
                                Authorization: `Bearer ${localStorage.getItem("token")}`,
                              },
                              body: formData,
                            }
                          );

                          if (response.ok) {
                            const result = await response.json();
                            field.onChange(result.archivo.rutaArchivo);
                            setFormValue("nombreArchivo", result.archivo.nombreArchivo);
                            setFormValue("tamañoArchivo", result.archivo.tamañoArchivo);

                            setFileUploadState({
                              isUploading: false,
                              uploadedFile: {
                                name: result.archivo.nombreArchivo,
                                size: formatFileSize(result.archivo.tamañoArchivo),
                              },
                              error: null,
                            });

                            if (abonadoValue) {
                              procesarArchivoAdjuntoDirecto(
                                abonadoValue,
                                result.archivo.rutaArchivo,
                                getOperador()
                              );
                            }
                          } else {
                            const errorText = await response.text();
                            field.onChange("");
                            setFileUploadState({
                              isUploading: false,
                              uploadedFile: null,
                              error: errorText || "Error subiendo archivo",
                            });
                          }
                        } catch (error) {
                          field.onChange("");
                          setFileUploadState({
                            isUploading: false,
                            uploadedFile: null,
                            error: "Error de conexión al subir archivo",
                          });
                        }
                      }
                    }}
                    className={`file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium ${
                      fileUploadState.uploadedFile
                        ? "border-green-500"
                        : fileUploadState.error
                        ? "border-red-500"
                        : ""
                    }`}
                  />

                  {fileUploadState.isUploading && (
                    <div className="flex items-center space-x-2 text-sm text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Subiendo archivo...</span>
                    </div>
                  )}

                  {fileUploadState.uploadedFile && (
                    <div className="flex items-center space-x-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>{fileUploadState.uploadedFile.name}</span>
                      <span className="text-gray-500">
                        ({fileUploadState.uploadedFile.size})
                      </span>
                    </div>
                  )}

                  {fileUploadState.error && (
                    <div className="flex items-center space-x-2 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>{fileUploadState.error}</span>
                    </div>
                  )}
                </div>
              </FormControl>
              <p className="text-sm text-gray-600">
                Formatos permitidos: XLS, XLSX
              </p>
              <FormMessage />
              {listaAnalisis.length > 0 && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  Carga individual deshabilitada porque hay elementos en la
                  Lista Multi-Target.
                </p>
              )}
            </FormItem>
          )}
        />
      )}

      {/* SECCIÓN: Resultados del análisis BTS */}
      <TablaBTS
        isAnalyzing={btsAnalysisState.isAnalyzing}
        results={btsAnalysisState.results}
        error={btsAnalysisState.error}
        selectedRows={selectedRows}
        copiedTable={copiedTable}
        onCopiar={copiarAlPortapapeles}
        onVerTabla={onVerTabla}
        abonadoValue={abonadoValue}
      />

      <TablaContactosFrecuentes
        state={contactosFrecuentesState}
        limitContactos={limitContactos}
        onSetLimitContactos={setLimitContactos}
        copiedTable={copiedTable}
        onCopiar={copiarAlPortapapeles}
        onVerDatosCrudos={onVerDatosCrudos}
        onVerContactos={onVerContactos}
        tiposColumnas={tiposColumnas}
        totales={totales}
        abonadoValue={abonadoValue}
        numeroSeleccionado={selectedIndex !== null ? listaAnalisis[selectedIndex]?.numero : undefined}
      />
    </>
  );
});

/**
 * Componente: Formulario para crear, editar o duplicar experticias
 *
 * Funcionalidades principales:
 * - Creación de nuevas experticias
 * - Edición de experticias existentes
 * - Duplicación de experticias
 * - Subida de archivos Excel (análisis BTS)
 * - Selección de filas del análisis BTS
 * - Validación de campos con Zod
 */
export function ExperticiasForm({
  experticia,
  onSubmit,
  onCancel,
  isLoading,
  preloadData,
}: ExperticiasFormProps) {
  // Detecta modo de operación
  const isEditing = !!experticia?.id; // true si estamos editando
  const isDuplicating = !!experticia && !experticia.id; // true si estamos duplicando
  const scrollContainerRef = useRef<HTMLFormElement>(null); // Ref para scroll suave del formulario
  const isSubmittingRef = useRef(false); // Ref para bloquear envíos duplicados
  const permissions = usePermissions(); // Permisos del usuario (ej: canEditCreationDates)
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading) {
      isSubmittingRef.current = false;
    }
  }, [isLoading]);

  /**
   * Estado para la subida de archivos Excel
   * - isUploading: indica si hay carga en progreso
   * - uploadedFile: nombre y tamaño del archivo subido (null si no hay)
   * - error: mensaje de error si la carga falla
   */
  const [fileUploadState, setFileUploadState] = useState<{
    isUploading: boolean;
    uploadedFile: { name: string; size: string } | null;
    error: string | null;
  }>({
    isUploading: false,
    uploadedFile: null,
    error: null,
  });

  /**
   * Estado para los resultados del análisis BTS (Base Transceptora Sistema)
   * - isAnalyzing: true mientras se procesa el archivo
   * - results: array de filas del análisis (null si no hay análisis)
   * - error: mensaje de error si el análisis falla
   */
  const [btsAnalysisState, setBtsAnalysisState] = useState<{
    isAnalyzing: boolean;
    results: any[] | null;
    error: string | null;
  }>({
    isAnalyzing: false,
    results: null,
    error: null,
  });

  /**
   * Estado para los resultados del análisis de Contactos Frecuentes
   * - isAnalyzing: true mientras se procesa el archivo
   * - datosCrudos: array de filas del Excel (primeras 6 columnas)
   * - todosLosContactos: todos los números con mayor frecuencia de comunicación
   * - error: mensaje de error si el análisis falla
   */
  const [contactosFrecuentesState, setContactosFrecuentesState] = useState<{
    isAnalyzing: boolean;
    datosCrudos: any[] | null;
    todosLosContactos: any[] | null;
    imeisUtilizados: any[] | null;
    error: string | null;
  }>({
    isAnalyzing: false,
    datosCrudos: null,
    todosLosContactos: null,
    imeisUtilizados: null,
    error: null,
  });

  // Controla si el modal expandido de resultados BTS está abierto
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  // Controla si el modal expandido de contactos frecuentes está abierto
  const [isContactosTableModalOpen, setIsContactosTableModalOpen] =
    useState(false);

  // Controla si el modal del TOP 10 contactos frecuentes está abierto
  const [isTop10ModalOpen, setIsTop10ModalOpen] = useState(false);

  // Controla cuántos contactos frecuentes se muestran en la tabla (10, 25 o todos)
  const [limitContactos, setLimitContactos] = useState<number | 'todos'>(10);

  // Buscadores de los modales
  const [searchBTS, setSearchBTS] = useState('');
  const [searchContactosFrecuentes, setSearchContactosFrecuentes] = useState('');
  const [searchRegistros, setSearchRegistros] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [debouncedSearchRegistros, setDebouncedSearchRegistros] = useState('');
  const [registrosScrollTop, setRegistrosScrollTop] = useState(0);
  const registrosScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchRegistros(searchRegistros), 200);
    return () => clearTimeout(timer);
  }, [searchRegistros]);

  const filteredRegistros = useMemo(() => {
    if (!contactosFrecuentesState.datosCrudos) return [];
    const parseDMY = (s: string) => { const [d, m, y] = s.split('/'); return d && m && y ? new Date(`${y}-${m}-${d}`) : null; };
    const desde = parseDMY(fechaDesde);
    const hasta = parseDMY(fechaHasta);
    const q = debouncedSearchRegistros.toLowerCase();
    return contactosFrecuentesState.datosCrudos.filter((row) => {
      if (fechaDesde || fechaHasta) {
        const f = parseDMY(String(row['Fecha'] || row['FECHA'] || ''));
        if (!f) return false;
        if (desde && f < desde) return false;
        if (hasta && f > hasta) return false;
      }
      if (q && !Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [contactosFrecuentesState.datosCrudos, debouncedSearchRegistros, fechaDesde, fechaHasta]);

  // Controla qué tabla fue copiada recientemente (feedback visual)
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  const copiarAlPortapapeles = useCallback((tableId: string, filas: any[], columnas: string[]) => {
    const header = columnas.join('\t');
    const rows = filas.map((fila) => columnas.map((col) => fila[col] ?? '').join('\t'));
    const tsv = [header, ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedTable(tableId);
      setTimeout(() => setCopiedTable(null), 2000);
    });
  }, [setCopiedTable]);

  /**
   * Estado para la gestión multi-target (múltiples números y archivos)
   */
  const [listaAnalisis, setListaAnalisis] = useState<
    Array<{
      id: string;
      numero: string;
      archivoNombre: string;
      archivoCrudo: File;
      operador: string;
      resultados: {
        bts?: any[];
        contactos?: {
          datosCrudos: any[];
          todosLosContactos: any[];
          imeisUtilizados: any[];
        };
      } | null;
    }>
  >([]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /**
   * Agrega un nuevo análisis a la lista temporal
   */
  const agregarAnalisis = async (
    numero: string,
    file: File,
    operador: string
  ) => {
    console.log("[MULTI-TARGET] agregarAnalisis llamado:", { numero, fileName: file?.name, operador });
    if (!numero || !file) {
      console.warn("[MULTI-TARGET] agregarAnalisis: número o archivo faltante", { numero, file });
      return;
    }

    if (listaAnalisis.length >= 10) {
      console.warn("[MULTI-TARGET] agregarAnalisis: límite de 10 alcanzado");
      toast({
        title: "Límite alcanzado",
        description: "Solo se permiten hasta 10 registros por experticia.",
        variant: "destructive",
      });
      return;
    }

    const nuevoItem = {
      id: Math.random().toString(36).substr(2, 9),
      numero,
      archivoNombre: file.name,
      archivoCrudo: file,
      operador,
      resultados: null,
    };
    setListaAnalisis((prev) => [...prev, nuevoItem]);
    if (listaAnalisis.length === 0) setSelectedIndex(0);
  };

  /**
   * Procesa un archivo adjunto directamente sin agregarlo a la tabla de experticia
   */
  const procesarArchivoAdjuntoDirecto = async (
    numero: string,
    rutaArchivo: string,
    operador: string
  ) => {
    if (!numero || !rutaArchivo) return;

    try {
      const token = localStorage.getItem("token");
      if (tipoExperticiaValue === "determinar_contacto_frecuente") {
        // Limpiar análisis BTS
        setBtsAnalysisState({
          isAnalyzing: false,
          results: null,
          error: null,
        });

        const res = await fetch(
          "/api/experticias/analizar-contactos-frecuentes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              archivo_excel: rutaArchivo,
              numero_buscar: numero,
              operador: operador,
            }),
          }
        );
        const data = await res.json();
        if (data.success) {
          setContactosFrecuentesState({
            isAnalyzing: false,
            datosCrudos: data.datos_crudos,
            todosLosContactos: data.top_10_contactos,
            imeisUtilizados: data.imeis_utilizados || null,
            error: null,
          });
          if (data.datos_filiatorios && Object.keys(data.datos_filiatorios).length > 0) {
            const f = data.datos_filiatorios;
            
            let cedulaLimpia = f.cedula || "";
            if (typeof cedulaLimpia === "number") cedulaLimpia = String(cedulaLimpia);

            setAfiliadoData((prev) => ({
              ...prev,
              cedula: cedulaLimpia || prev.cedula,
              nombre: f.nombre || prev.nombre,
              fechaDeNacimiento: f.fechaNacimiento || prev.fechaDeNacimiento,
              correo: f.correo || prev.correo,
              direccion: f.direccion || prev.direccion,
              statusLinea: f.statusLinea || prev.statusLinea,
              fechaActivacion: f.fechaActivacion || prev.fechaActivacion,
              otrosTlf: f.otrosTlf || prev.otrosTlf,
            }));
          }
        } else {
          setContactosFrecuentesState({
            isAnalyzing: false,
            datosCrudos: null,
            todosLosContactos: null,
            imeisUtilizados: null,
            error: data.message || "Error en análisis de contactos",
          });
        }
      } else {
        // Limpiar análisis de Contactos Frecuentes
        setContactosFrecuentesState({
          isAnalyzing: false,
          datosCrudos: null,
          todosLosContactos: null,
          imeisUtilizados: null,
          error: null,
        });

        const res = await fetch("/api/experticias/analizar-bts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            archivo_excel: rutaArchivo,
            numero_buscar: numero,
            operador: operador,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setBtsAnalysisState({
            isAnalyzing: false,
            results: data.data,
            error: null,
          });
        } else {
          setBtsAnalysisState({
            isAnalyzing: false,
            results: null,
            error: data.message || "Error en análisis BTS",
          });
        }
      }
    } catch (err) {
      setBtsAnalysisState({
        isAnalyzing: false,
        results: null,
        error: "Error procesando archivo",
      });
      setContactosFrecuentesState({
        isAnalyzing: false,
        datosCrudos: null,
        todosLosContactos: null,
        imeisUtilizados: null,
        error: "Error procesando archivo",
      });
    }
  };


  /**
   * Procesa todos los análisis en la lista.
   * Flujo por cada item:
   *   Paso 1 — Subir el archivo al servidor (igual que la carga individual)
   *   Paso 2 — Analizar con la ruta devuelta por el servidor
   */
  const procesarTodosLosAnalisis = async () => {
    console.log("[MULTI-TARGET] procesarTodosLosAnalisis iniciado. Total items:", listaAnalisis.length);
    if (listaAnalisis.length === 0) return;

    if (tipoExperticiaValue === "determinar_contacto_frecuente") {
      setContactosFrecuentesState((prev) => ({ ...prev, isAnalyzing: true }));
    } else {
      setBtsAnalysisState((prev) => ({ ...prev, isAnalyzing: true }));
    }

    const nuevaLista = [...listaAnalisis];

    for (let i = 0; i < nuevaLista.length; i++) {
      const item = nuevaLista[i];
      if (item.resultados) {
        console.log(`[MULTI-TARGET] Item ${i} (${item.numero}) ya procesado, saltando.`);
        continue;
      }

      try {
        const token = localStorage.getItem("token");
        console.log(`[MULTI-TARGET] Procesando item ${i}:`, { numero: item.numero, operador: item.operador, archivoNombre: item.archivoNombre, tipoExperticia: tipoExperticiaValue });

        if (tipoExperticiaValue === "determinar_contacto_frecuente") {

          // PASO 1: Subir el archivo al servidor para obtener la ruta en disco
          console.log(`[MULTI-TARGET] Paso 1 — Subiendo archivo al servidor: ${item.archivoNombre}`);
          const formData = new FormData();
          formData.append("archivo", item.archivoCrudo);

          const uploadRes = await fetch("/api/experticias/upload-archivo", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          console.log(`[MULTI-TARGET] Upload HTTP status:`, uploadRes.status, uploadRes.statusText);
          const uploadData = await uploadRes.json();
          console.log(`[MULTI-TARGET] Upload respuesta:`, uploadData);

          if (!uploadData.success) {
            console.error(`[MULTI-TARGET] Error subiendo archivo: ${uploadData.message}`);
            continue;
          }

          const rutaArchivo = uploadData.archivo.rutaArchivo;
          console.log(`[MULTI-TARGET] Archivo guardado en servidor: ${rutaArchivo}`);

          // PASO 2: Analizar usando la ruta del servidor (mismo flujo que carga individual)
          console.log(`[MULTI-TARGET] Paso 2 — Analizando contactos frecuentes para número: ${item.numero}`);
          const res = await fetch("/api/experticias/analizar-contactos-frecuentes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              archivo_excel: rutaArchivo,
              numero_buscar: item.numero,
              operador: item.operador,
            }),
          });

          console.log(`[MULTI-TARGET] Análisis HTTP status:`, res.status, res.statusText);
          const data = await res.json();
          console.log(`[MULTI-TARGET] Análisis respuesta:`, data);

          if (data.success) {
            nuevaLista[i].resultados = {
              contactos: {
                datosCrudos: data.datos_crudos,
                todosLosContactos: data.top_10_contactos,
                imeisUtilizados: data.imeis_utilizados || [],
              },
            };
            if (data.datos_filiatorios && Object.keys(data.datos_filiatorios).length > 0) {
              const f = data.datos_filiatorios;

              let cedulaLimpia = f.cedula || "";
              if (typeof cedulaLimpia === "string") cedulaLimpia = cedulaLimpia.replace(/\D/g, "");
              else if (typeof cedulaLimpia === "number") cedulaLimpia = String(cedulaLimpia);
              
              const prevData = afiliadosMapRef.current[item.numero] || {
                cedula: "", nombre: "", apellido: "", pseudonimo: "", fechaDeNacimiento: "", correo: "", direccion: "", statusLinea: "", rol: "Relacionado", fechaActivacion: "", otrosTlf: ""
              };
              const newData = {
                ...prevData,
                cedula: cedulaLimpia || prevData.cedula,
                nombre: f.nombre || prevData.nombre,
                fechaDeNacimiento: f.fechaNacimiento || prevData.fechaDeNacimiento,
                correo: f.correo || prevData.correo,
                direccion: f.direccion || prevData.direccion,
                statusLinea: f.statusLinea || prevData.statusLinea,
                rol: prevData.rol || "Relacionado",
                fechaActivacion: f.fechaActivacion || prevData.fechaActivacion,
                otrosTlf: f.otrosTlf || prevData.otrosTlf,
              };

              afiliadosMapRef.current[item.numero] = newData;

              setSelectedIndex((currentIdx) => {
                if (currentIdx === i) {
                  setAfiliadoData(newData);
                }
                return currentIdx;
              });
            }
            console.log(`[MULTI-TARGET] Item ${i} completado. Filas crudas: ${data.datos_crudos?.length}, Top contactos: ${data.todos_los_contactos?.length}`);
          } else {
            console.error(`[MULTI-TARGET] Análisis devolvió success=false:`, data.message);
          }

        } else {
          // Lógica para BTS normal — mismo flujo: subir primero, luego analizar
          console.log(`[MULTI-TARGET] Paso 1 BTS — Subiendo archivo: ${item.archivoNombre}`);
          const formData = new FormData();
          formData.append("archivo", item.archivoCrudo);

          const uploadRes = await fetch("/api/experticias/upload-archivo", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          const uploadData = await uploadRes.json();

          if (!uploadData.success) {
            console.error(`[MULTI-TARGET] Error subiendo archivo BTS: ${uploadData.message}`);
            continue;
          }

          console.log(`[MULTI-TARGET] Paso 2 BTS — Analizando para número: ${item.numero}`);
          const res = await fetch("/api/experticias/analizar-bts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              archivo_excel: uploadData.archivo.rutaArchivo,
              numero_buscar: item.numero,
              operador: item.operador,
            }),
          });
          const data = await res.json();
          if (data.success) {
            nuevaLista[i].resultados = { bts: data.data };
          }
        }
      } catch (err) {
        console.error(`[MULTI-TARGET] Error procesando item ${i} (${item.numero}):`, err);
      }
    }

    setListaAnalisis(nuevaLista);
    if (tipoExperticiaValue === "determinar_contacto_frecuente") {
      setContactosFrecuentesState((prev) => ({ ...prev, isAnalyzing: false }));
    } else {
      setBtsAnalysisState((prev) => ({ ...prev, isAnalyzing: false }));
    }
    console.log("[MULTI-TARGET] procesarTodosLosAnalisis finalizado.");
  };

  /**
   * Hook: Efecto para sincronizar los estados de visualización con el item seleccionado
   */
  useEffect(() => {
    if (selectedIndex !== null && listaAnalisis[selectedIndex]) {
      const item = listaAnalisis[selectedIndex];
      if (item.resultados) {
        if (item.resultados.bts) {
          setBtsAnalysisState({
            isAnalyzing: false,
            results: item.resultados.bts,
            error: null,
          });
        }
        if (item.resultados.contactos) {
          setContactosFrecuentesState({
            isAnalyzing: false,
            datosCrudos: item.resultados.contactos.datosCrudos,
            todosLosContactos: item.resultados.contactos.todosLosContactos,
            imeisUtilizados: item.resultados.contactos.imeisUtilizados || null,
            error: null,
          });
        }
      }
    }
  }, [selectedIndex, listaAnalisis]);

  // Set de índices de filas seleccionadas en la tabla de resultados BTS
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const [afiliadoData, setAfiliadoData] = useState({
    cedula: "",
    nombre: "",
    apellido: "",
    pseudonimo: "",
    fechaDeNacimiento: "",
    correo: "",
    direccion: "",
    statusLinea: "",
    rol: "Relacionado",
    fechaActivacion: "",
    otrosTlf: "",
    profesion: "",
    delito: "",
    fiscalia: "",
  });

  // Ref to hold the mapped afiliado data for each multi-target number
  const afiliadosMapRef = useRef<Record<string, typeof afiliadoData>>({});

  /**
   * Alterna la selección de una fila en la tabla BTS
   * Agrega o elimina el índice del set de filas seleccionadas
   */
  const toggleRowSelection = (index: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  /**
   * Effect: Carga datos guardados cuando se edita una experticia
   * Si la experticia tiene datosSeleccionados (filas previas), los restaura
   * y marca todas las filas como seleccionadas por defecto
   */
  useEffect(() => {
    if (
      experticia?.datosSeleccionados &&
      Array.isArray(experticia.datosSeleccionados)
    ) {
      const datosGuardados = experticia.datosSeleccionados as any[];
      if (datosGuardados.length > 0) {
        // Restaura resultados previos del análisis BTS
        setBtsAnalysisState({
          isAnalyzing: false,
          results: datosGuardados,
          error: null,
        });
        // Auto-selecciona todas las filas restauradas
        const allIndices = new Set(datosGuardados.map((_, index) => index));
        setSelectedRows(allIndices);
      }
    }
  }, [experticia?.datosSeleccionados]);

  /**
   * Convierte bytes a formato legible (Bytes, KB, MB, GB)
   * @param bytes - Tamaño en bytes
   * @returns String formateado ej: "2.45 MB"
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  /**
   * Hook: Inicializa el formulario con react-hook-form
   * - Usa Zod para validar todos los campos
   * - Carga valores previos de experticia o preloadData
   * - Mantiene sincronización automática entre estado y UI
   */
  const form = useForm<FormData>({
    resolver: zodResolver(experticiasFormSchema),
    defaultValues: {
      // Prioridad: experticia > preloadData > valor vacío/default
      numeroDictamen:
        experticia?.numeroDictamen || preloadData?.numeroDictamen || "",
      experto: experticia?.experto || preloadData?.experto || "",
      numeroComunicacion:
        experticia?.numeroComunicacion || preloadData?.numeroComunicacion || "",
      fechaComunicacion:
        experticia?.fechaComunicacion?.toString() ||
        preloadData?.fechaComunicacion ||
        "",
      motivo: experticia?.motivo || preloadData?.motivo || "",
      operador: experticia?.operador || preloadData?.operador || undefined,
      fechaRespuesta:
        experticia?.fechaRespuesta?.toString() ||
        preloadData?.fechaRespuesta ||
        "",
      archivoAdjunto:
        experticia?.archivoAdjunto ?? preloadData?.archivoAdjunto ?? "",
      nombreArchivo:
        experticia?.nombreArchivo ?? preloadData?.nombreArchivo ?? "",
      tamañoArchivo:
        experticia?.tamañoArchivo ?? preloadData?.tamañoArchivo ?? undefined,
      tipoExperticia:
        experticia?.tipoExperticia || preloadData?.tipoExperticia || "",
      abonado: experticia?.abonado ?? preloadData?.abonado ?? "",
      datosAbonado: experticia?.datosAbonado ?? preloadData?.datosAbonado ?? "",
      conclusion: experticia?.conclusion ?? preloadData?.conclusion ?? "",
      respuestaFechaCorreo:
        experticia?.respuestaFechaCorreo ??
        preloadData?.respuestaFechaCorreo ??
        "",
      horaRespuestaCorreo:
        experticia?.horaRespuestaCorreo ??
        preloadData?.horaRespuestaCorreo ??
        "",
      expediente: experticia?.expediente || preloadData?.expediente || "",
      estado: experticia?.estado || preloadData?.estado || "procesando",
      usuarioId: experticia?.usuarioId || preloadData?.usuarioId || undefined,
      createdAt: experticia?.createdAt
        ? new Date(experticia.createdAt).toISOString().split("T")[0]
        : "",
    },
  });

  /**
   * Observa cambios en los campos del formulario para habilitación de controles
   */
  const tipoExperticiaValue = useWatch({ control: form.control, name: "tipoExperticia" });

  const [sujetoEncontrado, setSujetoEncontrado] = useState<boolean | null>(null);

  /**
   * Restaura los Datos Afiliados desde el mapa local cuando se selecciona
   * un número distinto en la tabla Multi-Target.
   */
  useEffect(() => {
    if (
      tipoExperticiaValue === "determinar_contacto_frecuente" &&
      selectedIndex !== null &&
      listaAnalisis[selectedIndex]
    ) {
      const numero = listaAnalisis[selectedIndex].numero;
      if (afiliadosMapRef.current[numero]) {
        setAfiliadoData(afiliadosMapRef.current[numero]);
      } else {
        setAfiliadoData({
          cedula: "",
          nombre: "",
          apellido: "",
          pseudonimo: "",
          fechaDeNacimiento: "",
          correo: "",
          direccion: "",
          statusLinea: "",
          rol: "Relacionado",
          fechaActivacion: "",
          otrosTlf: "",
          profesion: "",
          delito: "",
          fiscalia: "",
        });
      }
    }
  }, [selectedIndex, listaAnalisis, tipoExperticiaValue]);

  /**
   * Guarda automáticamente los Datos Afiliados en el mapa local
   * asociados al número seleccionado actualmente en la tabla Multi-Target.
   */
  useEffect(() => {
    if (
      tipoExperticiaValue === "determinar_contacto_frecuente" &&
      selectedIndex !== null &&
      listaAnalisis[selectedIndex]
    ) {
      const numero = listaAnalisis[selectedIndex].numero;
      afiliadosMapRef.current[numero] = afiliadoData;
    }
  }, [afiliadoData, selectedIndex, listaAnalisis, tipoExperticiaValue]);

  useEffect(() => {
    const cedula = afiliadoData.cedula?.trim();
    if (!cedula || cedula.length <= 5) {
      setSujetoEncontrado(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/personas-casos/by-cedula/${encodeURIComponent(cedula)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setAfiliadoData((prev) => ({
            cedula: prev.cedula,
            nombre: data.nombre || "",
            apellido: data.apellido || "",
            pseudonimo: data.pseudonimo || "",
            fechaDeNacimiento: data.fechaDeNacimiento || "",
            correo: data.correo || "",
            direccion: data.direccion || "",
            statusLinea: prev.statusLinea,
            rol: prev.rol || "Relacionado",
          }));
          setSujetoEncontrado(true);
        } else {
          setSujetoEncontrado(false);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setSujetoEncontrado(false);
      });
    return () => controller.abort();
  }, [afiliadoData.cedula]);

  /** Tipos de columnas de transacción calculados una sola vez cuando cambian los contactos */
  const tiposColumnasMemorized = useMemo(() => {
    const tipos = new Set<string>();
    const ordenPrioridad = ['LLAMADA ENTRANTE', 'LLAMADA SALIENTE', 'SMS ENTRANTE', 'SMS SALIENTE'];
    contactosFrecuentesState.todosLosContactos?.forEach((c: any) => {
      Object.keys(c).forEach((key) => {
        if (!['numero', 'frecuencia', 'primera_fecha', 'ultima_fecha'].includes(key)) {
          tipos.add(key);
        }
      });
    });
    return Array.from(tipos).sort((a, b) => {
      const ia = ordenPrioridad.indexOf(a), ib = ordenPrioridad.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [contactosFrecuentesState.todosLosContactos]);

  /** Totales calculados una sola vez cuando cambian los contactos o el límite */
  const totalesMemorized = useMemo(() => {
    if (!contactosFrecuentesState.todosLosContactos) return null;
    const visibles = limitContactos === 'todos'
      ? contactosFrecuentesState.todosLosContactos
      : contactosFrecuentesState.todosLosContactos.slice(0, limitContactos as number);
    const parseFecha = (f: string) => {
      if (!f || f === '-') return null;
      const [d, m, y] = f.split('/');
      return d && m && y ? new Date(`${y}-${m}-${d}`) : new Date(f);
    };
    const fmt = (d: Date | null) => d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '-';
    const totalFrecuencia = visibles.reduce((s: number, c: any) => s + (c.frecuencia || 0), 0);
    const fechas = visibles.map((c: any) => parseFecha(c.primera_fecha || c.PRIMERA_FECHA || '')).filter(Boolean) as Date[];
    const fechasUltimas = visibles.map((c: any) => parseFecha(c.ultima_fecha || c.ULTIMA_FECHA || '')).filter(Boolean) as Date[];
    const primeraFecha = fechas.length ? fechas.reduce((a, b) => a < b ? a : b) : null;
    const ultimaFecha = fechasUltimas.length ? fechasUltimas.reduce((a, b) => a > b ? a : b) : null;
    const sumasPorTipo: Record<string, number> = {};
    tiposColumnasMemorized.forEach((tipo) => {
      sumasPorTipo[tipo] = visibles.reduce((s: number, c: any) => s + (c[tipo] || 0), 0);
    });
    return { visibles, totalFrecuencia, primeraFecha: fmt(primeraFecha), ultimaFecha: fmt(ultimaFecha), sumasPorTipo };
  }, [contactosFrecuentesState.todosLosContactos, limitContactos, tiposColumnasMemorized]);

  /**
   * Maneja el envío del formulario
   * - Valida que no haya carga de archivo en progreso
   * - Extrae y procesa las filas BTS seleccionadas o contactos frecuentes
   * - Envía datos completos al callback onSubmit del padre
   */
  const handleSubmit = async (data: FormData) => {
    if (fileUploadState.isUploading) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    let filasSeleccionadas: any[] = [];
    let datosAnalisis: any = null;
    let datosSeleccionadosTop10: any = null;

    const esContactoFrecuente = tipoExperticiaValue === "determinar_contacto_frecuente";
    const esMultiTarget = listaAnalisis.length > 0;

    if (esContactoFrecuente && esMultiTarget) {
      // MODO MULTI-TARGET: construir array JSONB con un objeto por cada número analizado
      const itemsConResultados = listaAnalisis.filter(
        (item) => item.resultados?.contactos
      );

      datosAnalisis = itemsConResultados.map((item) => ({
        numero:      item.numero,
        datos_crudos: item.resultados!.contactos!.datosCrudos  ?? [],
        top_10:      item.resultados!.contactos!.todosLosContactos ?? [],
      }));

      // El campo abonado guarda todos los números separados por coma
      (data as any).abonado = itemsConResultados.length > 0
        ? itemsConResultados.map((item) => item.numero).join(", ")
        : (data as any).abonado;

    } else if (esContactoFrecuente && contactosFrecuentesState.datosCrudos) {
      // MODO INDIVIDUAL: mismo comportamiento que antes
      datosAnalisis = contactosFrecuentesState.datosCrudos;
      filasSeleccionadas = extractSelectedRows(
        contactosFrecuentesState.datosCrudos,
        selectedRows
      );
      datosSeleccionadosTop10 = filasSeleccionadas;

    } else if (btsAnalysisState.results) {
      // MODO BTS: mismo comportamiento que antes
      filasSeleccionadas = extractSelectedRows(
        btsAnalysisState.results,
        selectedRows
      );
    }

    const submitData = {
      ...data,
      filasSeleccionadas,
      datosAnalisis,
      datosSeleccionadosTop10,
      listaAnalisis: listaAnalisis.map((item) => ({
        numero: item.numero,
        archivoNombre: item.archivoNombre,
        resultados: item.resultados,
      })),
    } as any;

    if (esContactoFrecuente && !esMultiTarget) {
      submitData.todosLosContactos = contactosFrecuentesState.todosLosContactos;
    }

    // Asegurar que el número actualmente visible queda guardado en el mapa
    if (
      esContactoFrecuente &&
      esMultiTarget &&
      selectedIndex !== null &&
      listaAnalisis[selectedIndex]
    ) {
      const numeroActual = listaAnalisis[selectedIndex].numero;
      afiliadosMapRef.current[numeroActual] = afiliadoData;
    }

    // PASO 1: Guardar primero los datos del sujeto (personas-casos / expediente_sujeto)
    // y capturar el ID del expediente_sujeto retornado para evitar re-consultas
    // ambiguas en el backend (problema de duplicados por telefono+expediente).
    const numToExpSujetoId: Record<string, number | null> = {};

    if (esContactoFrecuente && esMultiTarget) {
      // MODO MULTI-TARGET: un POST por cada número con cédula registrada
      const promesasPersonas = Object.entries(afiliadosMapRef.current)
        .filter(([, datosAfiliado]) => datosAfiliado.cedula?.trim())
        .map(([numeroAbonado, datosAfiliado]) =>
          fetch(`/api/personas-casos`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              cedula: datosAfiliado.cedula.trim(),
              nombre: datosAfiliado.nombre || null,
              apellido: datosAfiliado.apellido || null,
              pseudonimo: datosAfiliado.pseudonimo || null,
              fechaDeNacimiento: datosAfiliado.fechaDeNacimiento || null,
              correo: datosAfiliado.correo || null,
              direccion: datosAfiliado.direccion || null,
              statusLinea: datosAfiliado.statusLinea || null,
              fechaActivacion: datosAfiliado.fechaActivacion || null,
              otrosTlf: datosAfiliado.otrosTlf || null,
              rol: datosAfiliado.rol || null,
              profesion: datosAfiliado.profesion || null,
              delito: datosAfiliado.delito || null,
              fiscalia: datosAfiliado.fiscalia || null,
              telefono: numeroAbonado,
              expediente: (data as any).expediente || null,
            }),
          })
            .then((r) => r.json())
            .then((json) => {
              numToExpSujetoId[numeroAbonado] = json?.expediente?.id ?? null;
            })
            .catch((err) => console.error(`Error guardando afiliado ${numeroAbonado}:`, err))
        );
      await Promise.allSettled(promesasPersonas);
    } else {
      // MODO INDIVIDUAL
      const abonadoUnico = (data as any).abonado?.trim();
      if (abonadoUnico && afiliadoData.cedula.trim()) {
        await fetch(`/api/personas-casos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            cedula: afiliadoData.cedula.trim(),
            nombre: afiliadoData.nombre || null,
            apellido: afiliadoData.apellido || null,
            pseudonimo: afiliadoData.pseudonimo || null,
            fechaDeNacimiento: afiliadoData.fechaDeNacimiento || null,
            correo: afiliadoData.correo || null,
            direccion: afiliadoData.direccion || null,
            statusLinea: afiliadoData.statusLinea || null,
            fechaActivacion: afiliadoData.fechaActivacion || null,
            otrosTlf: afiliadoData.otrosTlf || null,
            rol: afiliadoData.rol || null,
            profesion: afiliadoData.profesion || null,
            delito: afiliadoData.delito || null,
            fiscalia: afiliadoData.fiscalia || null,
            telefono: abonadoUnico,
            expediente: (data as any).expediente || null,
          }),
        })
          .then((r) => r.json())
          .then((json) => {
            numToExpSujetoId[abonadoUnico] = json?.expediente?.id ?? null;
          })
          .catch(() => {});
      }
    }

    // PASO 2: Crear la experticia. Se inyecta el expedienteSujetoId capturado en
    // PASO 1 directamente en cada item de listaAnalisis para que el backend lo use
    // sin necesidad de re-consultar la BD (evita ambigüedad por duplicados).
    if (submitData.listaAnalisis?.length > 0) {
      submitData.listaAnalisis = submitData.listaAnalisis.map((item: any) => ({
        ...item,
        expedienteSujetoId: numToExpSujetoId[item.numero] ?? null,
      }));
    }

    try {
      await onSubmit(submitData);
    } catch {
      isSubmittingRef.current = false;
      return;
    }

    // PASO 3: Actualizar statusLinea/fechaActivacion en persona_telefonos (fire-and-forget,
    // no bloquea el flujo ni afecta el expediente_sujeto_id).
    if (esContactoFrecuente && esMultiTarget) {
      Object.entries(afiliadosMapRef.current).forEach(([numeroAbonado, datosAfiliado]) => {
        if (datosAfiliado.statusLinea || datosAfiliado.fechaActivacion) {
          fetch(`/api/persona-telefonos/update-by-numero`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ numero: numeroAbonado, statusLinea: datosAfiliado.statusLinea || null, fechaActivacion: datosAfiliado.fechaActivacion || null }),
          }).catch(() => {});
        }
      });
    } else {
      const abonadoUnico = (data as any).abonado?.trim();
      if (abonadoUnico && (afiliadoData.statusLinea || afiliadoData.fechaActivacion)) {
        fetch(`/api/persona-telefonos/update-by-numero`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
          body: JSON.stringify({ numero: abonadoUnico, statusLinea: afiliadoData.statusLinea || null, fechaActivacion: afiliadoData.fechaActivacion || null }),
        }).catch(() => {});
      }
    }
  };

  /**
   * Maneja scroll suave del formulario con teclas de flecha
   * - ArrowUp: scroll hacia arriba
   * - ArrowDown: scroll hacia abajo
   * Permite navegar el formulario largo de forma fluida
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const scrollAmount = 80; // Píxeles a desplazar por cada pulsación

    if (e.key === "ArrowUp") {
      e.preventDefault();
      scrollContainer.scrollTo({
        top: Math.max(0, scrollContainer.scrollTop - scrollAmount),
        behavior: "smooth",
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      scrollContainer.scrollTo({
        top: Math.min(
          scrollContainer.scrollHeight - scrollContainer.clientHeight,
          scrollContainer.scrollTop + scrollAmount
        ),
        behavior: "smooth",
      });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Atom className="h-5 w-5" />
          <span>
            {isEditing
              ? "Editar Experticia"
              : isDuplicating
              ? "Duplicar Experticia"
              : "Nueva Experticia"}
          </span>
        </DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form
          ref={scrollContainerRef}
          onSubmit={form.handleSubmit(handleSubmit)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="space-y-6 max-h-[70vh] overflow-y-auto focus:outline-none pr-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#d1d5db transparent",
          }}
        >
          {/* Información básica */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Información Básica</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="numeroDictamen"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº Dictamen*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ej: DICT-2024-001"
                        {...field}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expediente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expediente*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ej: EXP-2024-001"
                        {...field}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="experto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experto*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nombre del experto asignado"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numeroComunicacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº Comunicación*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ej: COM-2024-001"
                        {...field}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fechaComunicacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>C.Fecha</FormLabel>
                    <FormControl>
                      {permissions.canEditCreationDates ? (
                        <Input
                          placeholder="dd/mm/yyyy o dd-mm-yyyy"
                          {...field}
                          value={field.value?.toString() || ""}
                          onKeyDown={(e) =>
                            handleDateInputKeyDown(e, CHAR_PATTERNS.dateTime)
                          }
                        />
                      ) : (
                        <div className="flex items-center p-3 border rounded-md bg-gray-50">
                          <span className="text-sm text-gray-600">
                            {field.value?.toString() || "No establecida"} (Solo
                            administradores pueden editar fechas)
                          </span>
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fechaRespuesta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reg Desde/Hasta</FormLabel>
                    <FormControl>
                      {permissions.canEditCreationDates ? (
                        <Input
                          placeholder="desde: 20-11-2024 hasta: 19-11-2025"
                          {...field}
                          value={field.value?.toString() || ""}
                        />
                      ) : (
                        <div className="flex items-center p-3 border rounded-md bg-gray-50">
                          <span className="text-sm text-gray-600">
                            {field.value?.toString() || "No establecida"} (Solo
                            administradores pueden editar fechas)
                          </span>
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="respuestaFechaCorreo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Respuesta de Fecha del Correo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="dd/mm/yyyy o dd-mm-yyyy"
                        {...field}
                        value={field.value || ""}
                        onKeyDown={(e) => {
                          const allowedKeys = [
                            "Backspace",
                            "Delete",
                            "Tab",
                            "Enter",
                            "ArrowLeft",
                            "ArrowRight",
                            "ArrowUp",
                            "ArrowDown",
                            "Home",
                            "End",
                          ];
                          const allowedChars = /[0-9\/\-\s]/;

                          if (allowedKeys.includes(e.key)) {
                            return; // Permitir teclas de navegación
                          }

                          if (!allowedChars.test(e.key)) {
                            e.preventDefault(); // Bloquear letras y otros caracteres
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="horaRespuestaCorreo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="HH:MM (ej: 14:30)"
                        {...field}
                        value={field.value || ""}
                        onKeyDown={(e) =>
                          handleDateInputKeyDown(e, CHAR_PATTERNS.time)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="createdAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Fecha de Creación de la Experticia (Solo Experticias
                    Atrasadas o no Procesadas)
                  </FormLabel>
                  <FormControl>
                    {permissions.canEditCreationDates ? (
                      <Input
                        type="date"
                        placeholder="Seleccione fecha de creación"
                        {...field}
                        value={field.value || ""}
                      />
                    ) : (
                      <div className="flex items-center p-3 border rounded-md bg-gray-50">
                        <span className="text-sm text-gray-600">
                          {field.value
                            ? new Date(field.value).toLocaleDateString("es-ES")
                            : "Fecha automática"}{" "}
                          (Solo administradores pueden editar)
                        </span>
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Detalles de la experticia */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Detalles de la Experticia</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="operador"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operador*</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={listaAnalisis.length > 0}
                    >
                      <FormControl>
                        <SelectTrigger className={listaAnalisis.length > 0 ? "opacity-60 cursor-not-allowed" : ""}>
                          <SelectValue placeholder="Seleccionar operador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.id} value={op.id}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {listaAnalisis.length > 0 && (
                      <p className="text-xs text-amber-600 font-medium">
                        Operador bloqueado — todos los números deben ser del mismo operador.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipoExperticia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Experticia*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione tipo de experticia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPERTICIA_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUSES.map((st) => (
                          <SelectItem key={st.id} value={st.id}>
                            {st.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección*</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Dirección del lugar de interés criminalístico..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Información del abonado 
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Información del Abonado</h3>

            <FormField
              control={form.control}
              name="datosAbonado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Datos del Abonado</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Información adicional del abonado (nombre, dirección, etc.)"
                      {...field}
                      value={field.value || ""}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>*/}

          {/* SECCIÓN: Análisis y Detalles Técnicos BTS
              Contiene: campo abonado, subida de archivo Excel, análisis BTS, conclusiones */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Análisis, Detalles Técnicos</h3>

            {/* Campo Abonado: componente aislado para evitar re-renders en cascada */}
            <AbonadoInput control={form.control} />

            {/* Sección de análisis aislada — useWatch("abonado") vive solo aquí */}
            <SeccionAnalisisObjetivos
              control={form.control}
              tipoExperticiaValue={tipoExperticiaValue}
              listaAnalisis={listaAnalisis}
              setListaAnalisis={setListaAnalisis}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
              agregarAnalisis={agregarAnalisis}
              procesarTodosLosAnalisis={procesarTodosLosAnalisis}
              procesarArchivoAdjuntoDirecto={procesarArchivoAdjuntoDirecto}
              fileUploadState={fileUploadState}
              setFileUploadState={setFileUploadState}
              formatFileSize={formatFileSize}
              getOperador={() => form.getValues("operador") || ""}
              setFormValue={(name, value) => form.setValue(name as any, value)}
              btsAnalysisState={btsAnalysisState}
              contactosFrecuentesState={contactosFrecuentesState}
              selectedRows={selectedRows}
              copiedTable={copiedTable}
              copiarAlPortapapeles={copiarAlPortapapeles}
              onVerTabla={() => setIsTableModalOpen(true)}
              onVerDatosCrudos={() => setIsContactosTableModalOpen(true)}
              onVerContactos={() => setIsTop10ModalOpen(true)}
              limitContactos={limitContactos}
              setLimitContactos={setLimitContactos}
              tiposColumnas={tiposColumnasMemorized}
              totales={totalesMemorized}
            />

            {/* ── Datos Afiliados ── */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Datos Afiliados
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Cédula</label>
                  <Input
                    placeholder="Cédula del afiliado"
                    value={afiliadoData.cedula}
                    onChange={(e) => {
                      setSujetoEncontrado(null);
                      const val = e.target.value.replace(/\D/g, '');
                      setAfiliadoData((p) => ({ ...p, cedula: val }));
                    }}
                  />
                  {sujetoEncontrado === true && (
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                      ✅ Sujeto encontrado en el historial
                    </p>
                  )}
                  {sujetoEncontrado === false && afiliadoData.cedula.length > 5 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      🔍 Sujeto nuevo — se registrará al guardar
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nombre</label>
                  <Input
                    placeholder="Nombre"
                    value={afiliadoData.nombre}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Apellido</label>
                  <Input
                    placeholder="Apellido"
                    value={afiliadoData.apellido}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, apellido: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Seudónimo</label>
                  <Input
                    placeholder="Seudónimo o alias"
                    value={afiliadoData.pseudonimo}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, pseudonimo: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Fecha de Nacimiento</label>
                  <Input
                    placeholder="DD/MM/AAAA"
                    value={afiliadoData.fechaDeNacimiento}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, fechaDeNacimiento: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Correo</label>
                  <Input
                    placeholder="Correo electrónico"
                    type="email"
                    value={afiliadoData.correo}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, correo: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Status Línea</label>
                  <Input
                    placeholder="Estado de la línea"
                    value={afiliadoData.statusLinea}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, statusLinea: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Fecha Activación</label>
                  <Input
                    placeholder="DD/MM/AAAA"
                    value={afiliadoData.fechaActivacion}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, fechaActivacion: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Otros TLF</label>
                  <Input
                    placeholder="Teléfonos adicionales"
                    value={afiliadoData.otrosTlf}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, otrosTlf: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Rol</label>
                  <Select
                    value={afiliadoData.rol}
                    onValueChange={(val) => setAfiliadoData((p) => ({ ...p, rol: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Victima">Víctima</SelectItem>
                      <SelectItem value="Investigado">Investigado</SelectItem>
                      <SelectItem value="Relacionado">Relacionado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium">Dirección</label>
                  <Input
                    placeholder="Dirección del afiliado"
                    value={afiliadoData.direccion}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, direccion: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Profesión</label>
                  <Input
                    placeholder="Profesión del afiliado"
                    value={afiliadoData.profesion}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, profesion: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Delito</label>
                  <Input
                    placeholder="Delito imputado"
                    value={afiliadoData.delito}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, delito: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Fiscalía</label>
                  <Input
                    placeholder="Fiscalía asignada"
                    value={afiliadoData.fiscalia}
                    onChange={(e) => setAfiliadoData((p) => ({ ...p, fiscalia: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="conclusion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conclusión</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Conclusiones y resultados de la experticia..."
                      {...field}
                      value={field.value || ""}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Guardando..."
                : isEditing
                ? "Actualizar"
                : isDuplicating
                ? "Duplicar"
                : "Crear"}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={isTableModalOpen} onOpenChange={(open) => { setIsTableModalOpen(open); if (!open) setSearchBTS(''); }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Resultados del Análisis BTS</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 px-1 pb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar número, dirección..."
                value={searchBTS}
                onChange={(e) => setSearchBTS(e.target.value)}
                className="w-full pl-7 pr-3 h-8 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {searchBTS && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {btsAnalysisState.results?.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(searchBTS.toLowerCase()))).length} resultados
              </span>
            )}
          </div>
          <div className="overflow-auto max-h-[70vh]">
            {btsAnalysisState.results &&
              btsAnalysisState.results.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ABONADO A</TableHead>
                      <TableHead>ABONADO B</TableHead>
                      <TableHead>FECHA</TableHead>
                      <TableHead>HORA</TableHead>
                      <TableHead>TIME</TableHead>
                      <TableHead>DIRECCION</TableHead>
                      <TableHead>CORDENADAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {btsAnalysisState.results.filter((r) =>
                      !searchBTS || Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(searchBTS.toLowerCase()))
                    ).map((result, index) => (
                      <TableRow
                        key={index}
                        onClick={() => toggleRowSelection(index)}
                        className={`cursor-pointer transition-colors py-1 text-sm ${
                          selectedRows.has(index)
                            ? "bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/50"
                            : "hover:bg-muted/50"
                        }`}
                        data-testid={`row-bts-result-${index}`}
                      >
                        <TableCell className="py-1 px-2 text-xs">
                          {result["ABONADO A"] || result["ABONADO_A"] || "-"}
                        </TableCell>
                        <TableCell className="py-1 px-2 text-xs">
                          {result["ABONADO B"] || result["ABONADO_B"] || "-"}
                        </TableCell>
                        <TableCell className="py-1 px-2 text-xs">
                          {result["FECHA"] || "-"}
                        </TableCell>
                        <TableCell className="py-1 px-2 text-xs">
                          {result["HORA"] || "-"}
                        </TableCell>
                        <TableCell className="py-1 px-2 text-xs">
                          {result["TIME"] || "-"}
                        </TableCell>
                        <TableCell className="py-1 px-2 text-xs">
                          {result["DIRECCION"] || "-"}
                        </TableCell>
                        <TableCell className="py-1 px-2 text-xs">
                          {result["CORDENADAS"] || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isContactosTableModalOpen}
        onOpenChange={(open) => { setIsContactosTableModalOpen(open); if (!open) { setFechaDesde(''); setFechaHasta(''); setSearchRegistros(''); } }}
      >
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Registros de Comunicación - Vista Completa
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 px-1 pb-1 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar número, tipo, fecha..."
                value={searchRegistros}
                onChange={(e) => setSearchRegistros(e.target.value)}
                className="w-full pl-7 pr-3 h-8 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Fecha:</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Desde</span>
              <input
                type="text"
                placeholder="DD/MM/AAAA"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-28 px-2 h-8 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Hasta</span>
              <input
                type="text"
                placeholder="DD/MM/AAAA"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-28 px-2 h-8 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {(fechaDesde || fechaHasta || searchRegistros) && (
              <>
                <span className="text-xs text-muted-foreground">
                  {filteredRegistros.length} resultados
                </span>
                <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setSearchRegistros(''); }} className="text-xs text-blue-600 hover:underline">Limpiar</button>
              </>
            )}
          </div>
          <div
            ref={registrosScrollRef}
            className="overflow-auto max-h-[68vh]"
            onScroll={(e) => setRegistrosScrollTop((e.target as HTMLDivElement).scrollTop)}
          >
            {filteredRegistros.length > 0 && contactosFrecuentesState.datosCrudos && (() => {
              const ROW_H = 32;
              const containerH = registrosScrollRef.current?.clientHeight ?? 500;
              const buffer = 20;
              const startIdx = Math.max(0, Math.floor(registrosScrollTop / ROW_H) - buffer);
              const endIdx = Math.min(filteredRegistros.length, startIdx + Math.ceil(containerH / ROW_H) + buffer * 2);
              const paddingTop = startIdx * ROW_H;
              const paddingBottom = (filteredRegistros.length - endIdx) * ROW_H;
              const cols = Object.keys(contactosFrecuentesState.datosCrudos[0]);
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {cols.map((col) => <TableHead key={col}>{col}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={cols.length} /></tr>}
                    {filteredRegistros.slice(startIdx, endIdx).map((row, i) => (
                      <TableRow key={startIdx + i}>
                        {cols.map((col) => (
                          <TableCell key={col} className="py-1 px-2 text-xs">{row[col] || "-"}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={cols.length} /></tr>}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal TOP 10 Contactos Frecuentes */}
      <Dialog open={isTop10ModalOpen} onOpenChange={(open) => { setIsTop10ModalOpen(open); if (!open) setSearchContactosFrecuentes(''); }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Contactos Frecuentes</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 px-1 pb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar número..."
                value={searchContactosFrecuentes}
                onChange={(e) => setSearchContactosFrecuentes(e.target.value)}
                className="w-full pl-7 pr-3 h-8 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {searchContactosFrecuentes && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {contactosFrecuentesState.todosLosContactos?.filter((c: any) =>
                  Object.values(c).some((v) => String(v ?? '').toLowerCase().includes(searchContactosFrecuentes.toLowerCase()))
                ).length} resultados
              </span>
            )}
          </div>
          <div className="overflow-auto max-h-[68vh]">
            {contactosFrecuentesState.todosLosContactos &&
              contactosFrecuentesState.todosLosContactos.length > 0 && (() => {
                const datos = searchContactosFrecuentes
                  ? contactosFrecuentesState.todosLosContactos!.filter((c: any) =>
                      Object.values(c).some((v) => String(v ?? '').toLowerCase().includes(searchContactosFrecuentes.toLowerCase()))
                    )
                  : contactosFrecuentesState.todosLosContactos!;
                const ordenPrioridad = ['LLAMADA ENTRANTE', 'LLAMADA SALIENTE', 'SMS ENTRANTE', 'SMS SALIENTE'];
                const tiposSet = new Set<string>();
                datos.forEach((c: any) => Object.keys(c).forEach((k) => {
                  if (!['numero', 'frecuencia', 'primera_fecha', 'ultima_fecha'].includes(k)) tiposSet.add(k);
                }));
                const tiposSorted = Array.from(tiposSet).sort((a, b) => {
                  const ia = ordenPrioridad.indexOf(a), ib = ordenPrioridad.indexOf(b);
                  if (ia !== -1 && ib !== -1) return ia - ib;
                  if (ia !== -1) return -1; if (ib !== -1) return 1;
                  return a.localeCompare(b);
                });
                return (
                  <Table>
                    <TableHeader className="bg-blue-50">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>INTERLOCUTOR</TableHead>
                        {tiposSorted.map((tipo) => (
                          <TableHead key={tipo} className="text-center text-[10px] leading-tight font-bold text-blue-900">
                            {tipo}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold">TOTAL GENERAL</TableHead>
                        <TableHead>PRIMERA FECHA</TableHead>
                        <TableHead>ULTIMA FECHA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {datos.map((contacto: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="py-1 px-2 text-xs font-bold">{index + 1}</TableCell>
                          <TableCell className="py-1 px-2 text-xs font-mono font-bold">
                            {contacto.numero || contacto.NUMERO || '-'}
                          </TableCell>
                          {tiposSorted.map((tipo) => (
                            <TableCell key={tipo} className="py-1 px-2 text-xs text-center border-l border-gray-100">
                              {contacto[tipo] > 0 ? <span className="font-medium text-gray-700">{contacto[tipo]}</span> : ''}
                            </TableCell>
                          ))}
                          <TableCell className="py-1 px-2 text-xs text-center font-bold bg-blue-50/30">
                            {contacto.frecuencia || contacto.FRECUENCIA || 0}
                          </TableCell>
                          <TableCell className="py-1 px-2 text-xs text-gray-500">
                            {contacto.primera_fecha || contacto.PRIMERA_FECHA || '-'}
                          </TableCell>
                          <TableCell className="py-1 px-2 text-xs text-gray-500">
                            {contacto.ultima_fecha || contacto.ULTIMA_FECHA || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
