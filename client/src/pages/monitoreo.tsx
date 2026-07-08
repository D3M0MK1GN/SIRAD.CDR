import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { useLogs, buildChartData } from "@/hooks/use-logs";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Activity,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Search,
  ChevronDown,
  ChevronRight,
  LogIn,
  LogOut,
  FileEdit,
  Trash2,
  Eye,
  Wifi,
  ServerCrash,
  AlertCircle,
  RefreshCw,
  FileText,
  SearchCode,
  Settings,
  CalendarIcon,
  FileBadge,
  XCircle,
} from "lucide-react";

// ─── Generador de datos mock por horas ───────────────────────────────────────

function generarHoras(horas: number, perfil: number[]): { label: string; valor: number }[] {
  const ahora = new Date();
  return Array.from({ length: horas }, (_, i) => {
    const t = new Date(ahora.getTime() - (horas - 1 - i) * 3600_000);
    const h = t.getHours();
    const base = perfil[h % perfil.length] ?? 0;
    const ruido = Math.floor(Math.random() * 4);
    return {
      label: horas <= 24 ? `${String(h).padStart(2, "0")}:00` : `${t.getDate()}/${t.getMonth() + 1} ${String(h).padStart(2, "0")}:00`,
      valor: Math.max(0, base + ruido),
    };
  });
}

// Perfil típico de actividad (índice = hora del día)
const perfilActividad = [2,1,0,0,0,1,3,8,14,22,18,25,12,19,27,21,16,10,6,4,3,2,2,1];
const perfilTrazabilidad = [0,0,0,0,0,0,1,3,6,10,9,12,5,11,13,10,8,5,3,2,1,0,0,0];

// Para el gráfico mostramos datos pre-calculados (sin random en render)
const datosActividad24h: { label: string; valor: number }[] = perfilActividad.map((v, h) => ({
  label: `${String(h).padStart(2, "0")}:00`,
  valor: v,
}));

const datosActividad72h: { label: string; valor: number }[] = [
  // Día -2
  ...[6,4,2,1,0,1,3,9,15,20,17,24,11,18,26,20,15,9,5,3,2,1,2,1].map((v, h) => ({
    label: h % 6 === 0 ? `D-2 ${String(h).padStart(2,"0")}:00` : `${String(h).padStart(2,"0")}:00`,
    valor: v,
  })),
  // Día -1
  ...[3,2,1,0,0,1,2,7,13,21,16,23,10,17,25,19,14,8,4,3,2,2,1,1].map((v, h) => ({
    label: h % 6 === 0 ? `D-1 ${String(h).padStart(2,"0")}:00` : `${String(h).padStart(2,"0")}:00`,
    valor: v,
  })),
  // Día actual
  ...perfilActividad.map((v, h) => ({
    label: h % 6 === 0 ? `Hoy ${String(h).padStart(2,"0")}:00` : `${String(h).padStart(2,"0")}:00`,
    valor: v,
  })),
];

const datosTrazabilidad24h: { label: string; valor: number }[] = perfilTrazabilidad.map((v, h) => ({
  label: `${String(h).padStart(2, "0")}:00`,
  valor: v,
}));

const datosTrazabilidad72h: { label: string; valor: number }[] = [
  ...[0,0,0,0,0,0,1,4,7,11,8,13,4,10,12,9,7,4,2,1,0,0,0,0].map((v, h) => ({
    label: h % 6 === 0 ? `D-2 ${String(h).padStart(2,"0")}:00` : `${String(h).padStart(2,"0")}:00`,
    valor: v,
  })),
  ...[0,0,0,0,0,0,1,2,5,9,8,11,4,9,11,8,6,3,2,1,0,0,0,0].map((v, h) => ({
    label: h % 6 === 0 ? `D-1 ${String(h).padStart(2,"0")}:00` : `${String(h).padStart(2,"0")}:00`,
    valor: v,
  })),
  ...perfilTrazabilidad.map((v, h) => ({
    label: h % 6 === 0 ? `Hoy ${String(h).padStart(2,"0")}:00` : `${String(h).padStart(2,"0")}:00`,
    valor: v,
  })),
];

// Mock de datos por día (para rango personalizado)
const datosPorDia: Record<string, { label: string; valor: number }[]> = {
  actividad: [
    { label: "01/07", valor: 183 },
    { label: "02/07", valor: 210 },
    { label: "03/07", valor: 95 },
    { label: "04/07", valor: 78 },
    { label: "05/07", valor: 230 },
    { label: "06/07", valor: 198 },
    { label: "07/07", valor: 218 },
  ],
  trazabilidad: [
    { label: "01/07", valor: 42 },
    { label: "02/07", valor: 61 },
    { label: "03/07", valor: 28 },
    { label: "04/07", valor: 19 },
    { label: "05/07", valor: 74 },
    { label: "06/07", valor: 55 },
    { label: "07/07", valor: 63 },
  ],
};

// ─── Alertas y registros de actividad ────────────────────────────────────────

const alertasRecientes = [
  { id: 1, tipo: "critica",     mensaje: "5 intentos de login fallidos: usuario jperez",                        hora: "14:32" },
  { id: 2, tipo: "advertencia", mensaje: "Acceso desde IP desconocida: 190.45.12.88 (usuario: mrodriguez)",     hora: "12:15" },
  { id: 3, tipo: "advertencia", mensaje: "Sesión activa desde 2 dispositivos distintos: lgarcia",              hora: "10:47" },
  { id: 4, tipo: "info",        mensaje: "Usuario bloqueado por exceder intentos: cgomez",                      hora: "09:21" },
  { id: 5, tipo: "info",        mensaje: "Cambio de contraseña detectado: admin",                               hora: "08:05" },
];

// Acciones contempladas:
// Autenticación: login, login_fail, logout, session_expired
// Solicitudes:   solicitud_create, solicitud_update
// Experticias:   experticia_create_analizar, experticia_update, experticia_delete, experticia_export_word
// Trazabilidad:  trazabilidad_search, trazabilidad_detail_view
// Plantillas:    plantilla_create, plantilla_update, plantilla_delete
// Configuración: config_change
// Seguridad:     failed_access, suspicious_action
const registrosActividad = [
  { id:  1, fecha: "07/07/2026 14:52", usuario: "jperez",     accion: "login_fail",               modulo: "Autenticación", ip: "192.168.1.22",  resultado: "error"   },
  { id:  2, fecha: "07/07/2026 14:45", usuario: "mrodriguez", accion: "solicitud_create",          modulo: "Solicitudes",   ip: "190.45.12.88",  resultado: "exitoso" },
  { id:  3, fecha: "07/07/2026 14:30", usuario: "lgarcia",    accion: "experticia_create_analizar",modulo: "Experticias",   ip: "192.168.1.15",  resultado: "exitoso" },
  { id:  4, fecha: "07/07/2026 14:10", usuario: "admin",      accion: "trazabilidad_search",       modulo: "Trazabilidad",  ip: "192.168.1.1",   resultado: "exitoso" },
  { id:  5, fecha: "07/07/2026 13:55", usuario: "cgomez",     accion: "login_fail",               modulo: "Autenticación", ip: "200.11.55.9",   resultado: "error"   },
  { id:  6, fecha: "07/07/2026 13:30", usuario: "admin",      accion: "trazabilidad_detail_view",  modulo: "Trazabilidad",  ip: "192.168.1.1",   resultado: "exitoso" },
  { id:  7, fecha: "07/07/2026 13:10", usuario: "mrodriguez", accion: "experticia_export_word",    modulo: "Experticias",   ip: "190.45.12.88",  resultado: "exitoso" },
  { id:  8, fecha: "07/07/2026 12:48", usuario: "lgarcia",    accion: "solicitud_update",          modulo: "Solicitudes",   ip: "192.168.1.15",  resultado: "exitoso" },
  { id:  9, fecha: "07/07/2026 12:15", usuario: "mrodriguez", accion: "login",                     modulo: "Autenticación", ip: "190.45.12.88",  resultado: "exitoso" },
  { id: 10, fecha: "07/07/2026 11:50", usuario: "jperez",     accion: "plantilla_delete",          modulo: "Plantillas",    ip: "192.168.1.22",  resultado: "exitoso" },
  { id: 11, fecha: "07/07/2026 11:33", usuario: "lgarcia",    accion: "experticia_update",         modulo: "Experticias",   ip: "192.168.1.15",  resultado: "exitoso" },
  { id: 12, fecha: "07/07/2026 10:47", usuario: "lgarcia",    accion: "login",                     modulo: "Autenticación", ip: "10.0.0.5",      resultado: "exitoso" },
  { id: 13, fecha: "07/07/2026 10:20", usuario: "admin",      accion: "config_change",             modulo: "Configuración", ip: "192.168.1.1",   resultado: "exitoso" },
  { id: 14, fecha: "07/07/2026 09:55", usuario: "mrodriguez", accion: "trazabilidad_search",       modulo: "Trazabilidad",  ip: "190.45.12.88",  resultado: "exitoso" },
  { id: 15, fecha: "07/07/2026 09:21", usuario: "cgomez",     accion: "failed_access",             modulo: "Seguridad",     ip: "200.11.55.9",   resultado: "error"   },
  { id: 16, fecha: "07/07/2026 09:00", usuario: "jperez",     accion: "plantilla_create",          modulo: "Plantillas",    ip: "192.168.1.22",  resultado: "exitoso" },
  { id: 17, fecha: "07/07/2026 08:45", usuario: "admin",      accion: "experticia_delete",         modulo: "Experticias",   ip: "192.168.1.1",   resultado: "exitoso" },
  { id: 18, fecha: "07/07/2026 08:20", usuario: "lgarcia",    accion: "logout",                    modulo: "Autenticación", ip: "192.168.1.15",  resultado: "exitoso" },
  { id: 19, fecha: "07/07/2026 08:05", usuario: "admin",      accion: "plantilla_update",          modulo: "Plantillas",    ip: "192.168.1.1",   resultado: "exitoso" },
  { id: 20, fecha: "07/07/2026 07:50", usuario: "cgomez",     accion: "suspicious_action",         modulo: "Seguridad",     ip: "200.11.55.9",   resultado: "error"   },
];

const registrosErrores = [
  { id: 1, fecha: "07/07/2026 14:50", nivel: "error",    servicio: "Node",       mensaje: "Cannot read properties of undefined (reading 'id')",    endpoint: "POST /api/solicitudes",  revisado: false, detalle: "TypeError: Cannot read properties of undefined (reading 'id')\n  at createSolicitud (server/routes.ts:142)" },
  { id: 2, fecha: "07/07/2026 13:22", nivel: "warn",     servicio: "PostgreSQL", mensaje: "Conexión lenta: query tardó 2800ms",                      endpoint: "GET /api/stats",          revisado: false, detalle: "Query: SELECT COUNT(*) FROM solicitudes WHERE estado = 'procesando' AND fecha_solicitud > NOW() - INTERVAL '30 days'" },
  { id: 3, fecha: "07/07/2026 12:01", nivel: "error",    servicio: "Python",     mensaje: "FileNotFoundError: archivo Excel no encontrado",           endpoint: "POST /analizar-bts",      revisado: true,  detalle: "FileNotFoundError: [Errno 2] No such file or directory: '/uploads/bts_marzo.xlsx'" },
  { id: 4, fecha: "07/07/2026 10:15", nivel: "warn",     servicio: "Node",       mensaje: "JWT expirado no renovado correctamente",                   endpoint: "GET /api/auth/me",        revisado: true,  detalle: "JsonWebTokenError: jwt expired at /server/routes.ts:58" },
  { id: 5, fecha: "07/07/2026 08:44", nivel: "critical", servicio: "PostgreSQL", mensaje: "Error de conexión a la base de datos",                     endpoint: "Sistema",                 revisado: false, detalle: "Error: connect ECONNREFUSED 127.0.0.1:5432\n  at TCPConnectWrap.afterConnect" },
];

const eventosSeguidad = [
  { id: 1, fecha: "07/07/2026 14:32", tipo: "Login fallido",      usuario: "jperez",     ip: "192.168.1.22", detalle: "5 intentos consecutivos",                       nivel: "alto"  },
  { id: 2, fecha: "07/07/2026 12:15", tipo: "IP desconocida",     usuario: "mrodriguez", ip: "190.45.12.88", detalle: "Primera vez que accede desde esta IP",            nivel: "medio" },
  { id: 3, fecha: "07/07/2026 10:47", tipo: "Sesión duplicada",   usuario: "lgarcia",    ip: "10.0.0.5",     detalle: "Sesión activa desde 2 dispositivos",              nivel: "medio" },
  { id: 4, fecha: "07/07/2026 09:21", tipo: "Cuenta bloqueada",   usuario: "cgomez",     ip: "200.11.55.9",  detalle: "Bloqueado por exceder intentos fallidos",         nivel: "alto"  },
  { id: 5, fecha: "07/07/2026 08:05", tipo: "Cambio contraseña",  usuario: "admin",      ip: "192.168.1.1",  detalle: "Contraseña modificada exitosamente",              nivel: "bajo"  },
];

// ─── Labels de acciones ───────────────────────────────────────────────────────

const accionLabel: Record<string, string> = {
  login:                    "Login exitoso",
  login_fail:               "Login fallido",
  logout:                   "Cierre de sesión",
  session_expired:          "Sesión expirada",
  solicitud_create:         "Crear solicitud",
  solicitud_update:         "Actualizar solicitud",
  experticia_create_analizar: "Crear y analizar experticia",
  experticia_update:        "Actualizar experticia",
  experticia_delete:        "Eliminar experticia",
  experticia_export_word:   "Exportar experticia (Word)",
  trazabilidad_search:      "Búsqueda en trazabilidad",
  trazabilidad_detail_view: "Ver detalle de trazabilidad",
  plantilla_create:         "Crear plantilla",
  plantilla_update:         "Actualizar plantilla",
  plantilla_delete:         "Eliminar plantilla",
  config_change:            "Cambio de configuración",
  failed_access:            "Acceso denegado",
  suspicious_action:        "Acción sospechosa",
};

const accionIcono: Record<string, React.ReactNode> = {
  login:                    <LogIn  className="h-3.5 w-3.5 text-green-500" />,
  login_fail:               <LogIn  className="h-3.5 w-3.5 text-red-500" />,
  logout:                   <LogOut className="h-3.5 w-3.5 text-gray-500" />,
  session_expired:          <Clock  className="h-3.5 w-3.5 text-amber-500" />,
  solicitud_create:         <FileEdit className="h-3.5 w-3.5 text-blue-500" />,
  solicitud_update:         <FileEdit className="h-3.5 w-3.5 text-sky-500" />,
  experticia_create_analizar: <FileBadge className="h-3.5 w-3.5 text-indigo-500" />,
  experticia_update:        <FileEdit className="h-3.5 w-3.5 text-violet-500" />,
  experticia_delete:        <Trash2  className="h-3.5 w-3.5 text-red-500" />,
  experticia_export_word:   <FileText className="h-3.5 w-3.5 text-blue-700" />,
  trazabilidad_search:      <SearchCode className="h-3.5 w-3.5 text-teal-500" />,
  trazabilidad_detail_view: <Eye    className="h-3.5 w-3.5 text-teal-700" />,
  plantilla_create:         <FileText className="h-3.5 w-3.5 text-emerald-500" />,
  plantilla_update:         <FileText className="h-3.5 w-3.5 text-emerald-600" />,
  plantilla_delete:         <Trash2  className="h-3.5 w-3.5 text-red-400" />,
  config_change:            <Settings className="h-3.5 w-3.5 text-gray-600" />,
  failed_access:            <XCircle className="h-3.5 w-3.5 text-red-600" />,
  suspicious_action:        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
};

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const errorNivelColor: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  error:    "bg-orange-100 text-orange-700",
  warn:     "bg-amber-100 text-amber-700",
};

const seguridadNivelColor: Record<string, string> = {
  alto:  "bg-red-100 text-red-700",
  medio: "bg-amber-100 text-amber-700",
  bajo:  "bg-blue-100 text-blue-700",
};

// ─── Componente: KPI Card ─────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Componente: Badge alerta ──────────────────────────────────────────────────

function AlertaBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    critica:     { label: "Crítica",     cls: "bg-red-100 text-red-700 border-red-200" },
    advertencia: { label: "Advertencia", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    info:        { label: "Info",        cls: "bg-blue-100 text-blue-700 border-blue-200" },
  };
  const { label, cls } = map[tipo] ?? { label: tipo, cls: "" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

// ─── Componente: Selector de período con calendario ───────────────────────────

type Periodo = "24h" | "72h" | "rango";

function SelectorPeriodo({
  valor,
  onChange,
  rango,
  onRangoChange,
}: {
  valor: Periodo;
  onChange: (v: Periodo) => void;
  rango: DateRange | undefined;
  onRangoChange: (r: DateRange | undefined) => void;
}) {
  const [calAbierto, setCalAbierto] = useState(false);

  const labelRango =
    rango?.from && rango?.to
      ? `${format(rango.from, "dd/MM/yy")} – ${format(rango.to, "dd/MM/yy")}`
      : rango?.from
      ? `Desde ${format(rango.from, "dd/MM/yy")}`
      : "Seleccionar rango";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(["24h", "72h", "rango"] as Periodo[]).map((p) => (
        <Button
          key={p}
          variant={valor === p ? "default" : "outline"}
          size="sm"
          className={`h-7 px-3 text-xs ${valor === p ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-gray-600"}`}
          onClick={() => onChange(p)}
        >
          {p === "24h" ? "24 horas" : p === "72h" ? "72 horas" : "Rango"}
        </Button>
      ))}

      {valor === "rango" && (
        <Popover open={calAbierto} onOpenChange={setCalAbierto}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs gap-1.5 text-gray-600 border-dashed"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {labelRango}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="!w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={rango}
              onSelect={(r) => {
                onRangoChange(r);
                if (r?.from && r?.to) setCalAbierto(false);
              }}
              numberOfMonths={1}
              locale={es}
              disabled={{ after: new Date() }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── Tab: Vista General ────────────────────────────────────────────────────────

function TabGeneral() {
  const [periodoActividad, setPeriodoActividad]     = useState<Periodo>("24h");
  const [rangoActividad, setRangoActividad]         = useState<DateRange | undefined>();
  const [periodoTrazab, setPeriodoTrazab]           = useState<Periodo>("24h");
  const [rangoTrazab, setRangoTrazab]               = useState<DateRange | undefined>();

  const { actividad, errores, seguridad, metricas } = useLogs(72);

  const datosActividad = useMemo(
    () => buildChartData(metricas, "actividad", periodoActividad, rangoActividad),
    [metricas, periodoActividad, rangoActividad]
  );

  const datosTrazab = useMemo(
    () => buildChartData(metricas, "trazabilidad", periodoTrazab, rangoTrazab),
    [metricas, periodoTrazab, rangoTrazab]
  );

  const tickInterval = (datos: { label: string }[]) =>
    datos.length <= 24 ? 3 : datos.length <= 72 ? 11 : 0;

  const usuariosActivos = new Set(actividad.map((a) => a.usuario)).size;
  const accionesHoy = actividad.length;
  const erroresSinRevisar = errores.filter((e) => !e.revisado).length;
  const loginFallidos = seguridad.filter((s) => s.tipo === "Login fallido").length;
  const alertasAltas = seguridad.filter((s) => s.nivel === "alto").length;

  const alertasRecientesReales = seguridad.slice(0, 5).map((s) => ({
    id: s.id,
    tipo: s.nivel === "alto" ? "critica" : s.nivel === "medio" ? "advertencia" : "info",
    mensaje: `${s.tipo}${s.usuario ? ` (${s.usuario})` : ""}${s.detalle ? ` - ${s.detalle}` : ""}`,
    hora: s.fecha.split(" ")[1] || "-",
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<Users       className="h-5 w-5 text-blue-600" />}
          label="Usuarios activos ahora" value={usuariosActivos} sub="con actividad reciente" color="bg-blue-50"
        />
        <KpiCard
          icon={<Activity    className="h-5 w-5 text-green-600" />}
          label="Acciones hoy" value={accionesHoy} sub="últimas 24 horas" color="bg-green-50"
        />
        <KpiCard
          icon={<ServerCrash className="h-5 w-5 text-orange-600" />}
          label="Errores del sistema" value={erroresSinRevisar} sub="sin revisar" color="bg-orange-50"
        />
        <KpiCard
          icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
          label="Login fallidos" value={loginFallidos} sub="en las últimas 24h" color="bg-red-50"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          label="Alertas pendientes" value={alertasAltas} sub="requieren atención" color="bg-amber-50"
        />
      </div>

      {/* Gráfico actividad + alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Actividad del sistema
              </CardTitle>
              <SelectorPeriodo
                valor={periodoActividad}
                onChange={setPeriodoActividad}
                rango={rangoActividad}
                onRangoChange={setRangoActividad}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={datosActividad}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickLine={false} axisLine={false}
                  interval={tickInterval(datosActividad)}
                />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(v: number) => [v, "Acciones"]}
                />
                <Line type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Alertas recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-50">
              {alertasRecientesReales.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    <AlertaBadge tipo={a.tipo} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 leading-snug">{a.mensaje}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {a.hora}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico consultas de trazabilidad */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-gray-700">
                Consultas de Trazabilidad
              </CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">Búsquedas realizadas en la sección Análisis de Trazabilidad</p>
            </div>
            <SelectorPeriodo
              valor={periodoTrazab}
              onChange={setPeriodoTrazab}
              rango={rangoTrazab}
              onRangoChange={setRangoTrazab}
            />
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={datosTrazab}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false} axisLine={false}
                interval={tickInterval(datosTrazab)}
              />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
                formatter={(v: number) => [v, "Consultas"]}
              />
              <Line type="monotone" dataKey="valor" stroke="#0d9488" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Actividad ────────────────────────────────────────────────────────────

function TabActividad() {
  const [busqueda, setBusqueda]           = useState("");
  const [filtroResultado, setFiltroResultado] = useState("todos");
  const [filtroModulo, setFiltroModulo]   = useState("todos");
  const { actividad } = useLogs();

  const datos = useMemo(() => {
    return actividad.filter((r) => {
      const label = accionLabel[r.accion] ?? r.accion;
      const matchBusqueda =
        !busqueda ||
        r.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
        label.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.accion.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.ip.includes(busqueda);
      const matchResultado = filtroResultado === "todos" || r.resultado === filtroResultado;
      const matchModulo    = filtroModulo === "todos"    || r.modulo === filtroModulo;
      return matchBusqueda && matchResultado && matchModulo;
    });
  }, [busqueda, filtroResultado, filtroModulo, actividad]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar usuario, acción o IP..."
            className="pl-9 h-9 text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={filtroModulo} onValueChange={setFiltroModulo}>
          <SelectTrigger className="h-9 w-48 text-sm">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los módulos</SelectItem>
            <SelectItem value="Autenticación">Autenticación</SelectItem>
            <SelectItem value="Solicitudes">Solicitudes</SelectItem>
            <SelectItem value="Experticias">Experticias</SelectItem>
            <SelectItem value="Trazabilidad">Trazabilidad</SelectItem>
            <SelectItem value="Plantillas">Plantillas</SelectItem>
            <SelectItem value="Configuración">Configuración</SelectItem>
            <SelectItem value="Seguridad">Seguridad</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroResultado} onValueChange={setFiltroResultado}>
          <SelectTrigger className="h-9 w-40 text-sm">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="exitoso">Exitoso</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-auto">{datos.length} registros</span>
      </div>

      {/* Tabla */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-xs font-semibold text-gray-600 w-40">Fecha / Hora</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Usuario</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Acción</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Módulo</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">IP</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 text-center">Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-400 py-10">
                  No se encontraron registros
                </TableCell>
              </TableRow>
            ) : (
              datos.map((r) => (
                <TableRow key={r.id} className="hover:bg-gray-50 text-sm">
                  <TableCell className="text-xs text-gray-500 font-mono">{r.fecha}</TableCell>
                  <TableCell className="font-medium text-gray-800">{r.usuario}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-gray-700">
                      {accionIcono[r.accion] ?? <Activity className="h-3.5 w-3.5 text-gray-400" />}
                      {accionLabel[r.accion] ?? r.accion}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.modulo}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Wifi className="h-3 w-3 text-gray-300" /> {r.ip}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.resultado === "exitoso" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {r.resultado === "exitoso" ? "Exitoso" : "Error"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Tab: Errores ─────────────────────────────────────────────────────────────

function TabErrores() {
  const [filtroNivel,    setFiltroNivel]    = useState("todos");
  const [filtroServicio, setFiltroServicio] = useState("todos");
  const [expandido,      setExpandido]      = useState<number | null>(null);
  const { errores } = useLogs();
  const [revisados,      setRevisados]      = useState<Set<number>>(
    new Set(errores.filter((e) => e.revisado).map((e) => e.id))
  );

  const datos = useMemo(() => errores.filter((e) => {
    const matchNivel    = filtroNivel    === "todos" || e.nivel    === filtroNivel;
    const matchServicio = filtroServicio === "todos" || e.servicio === filtroServicio;
    return matchNivel && matchServicio;
  }), [filtroNivel, filtroServicio, errores]);

  const marcarRevisado = (id: number) =>
    setRevisados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filtroNivel} onValueChange={setFiltroNivel}>
          <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Nivel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los niveles</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Advertencia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroServicio} onValueChange={setFiltroServicio}>
          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Servicio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Node">Node</SelectItem>
            <SelectItem value="Python">Python</SelectItem>
            <SelectItem value="PostgreSQL">PostgreSQL</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-auto">
          {datos.filter((e) => !revisados.has(e.id)).length} sin revisar
        </span>
      </div>

      <div className="space-y-2">
        {datos.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="text-center text-sm text-gray-400 py-10">
              No se encontraron errores con los filtros seleccionados
            </CardContent>
          </Card>
        ) : (
          datos.map((e) => {
            const estaExpandido = expandido === e.id;
            const estaRevisado  = revisados.has(e.id);
            return (
              <Card key={e.id} className={`border-0 shadow-sm transition-opacity ${estaRevisado ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpandido(estaExpandido ? null : e.id)}>
                    <div className="mt-0.5">
                      {estaExpandido
                        ? <ChevronDown  className="h-4 w-4 text-gray-400" />
                        : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${errorNivelColor[e.nivel]}`}>
                          {e.nivel.toUpperCase()}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.servicio}</span>
                        <span className="text-xs text-gray-400 font-mono ml-auto">{e.fecha}</span>
                      </div>
                      <p className="text-sm text-gray-800 truncate">{e.mensaje}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{e.endpoint}</p>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className={`text-xs h-7 px-2 ml-2 flex-shrink-0 ${estaRevisado ? "text-green-600" : "text-gray-400"}`}
                      onClick={(ev) => { ev.stopPropagation(); marcarRevisado(e.id); }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                      {estaRevisado ? "Revisado" : "Marcar"}
                    </Button>
                  </div>
                  {estaExpandido && (
                    <pre className="mt-3 ml-7 text-xs bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto leading-relaxed">
                      {e.detalle}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Tab: Seguridad ────────────────────────────────────────────────────────────

function TabSeguridad() {
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const { seguridad } = useLogs();

  const datos = useMemo(() =>
    seguridad.filter((e) => filtroNivel === "todos" || e.nivel === filtroNivel),
    [filtroNivel, seguridad]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-red-500 font-medium">Riesgo alto</p>
              <p className="text-2xl font-bold text-red-700">{eventosSeguidad.filter((e) => e.nivel === "alto").length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-amber-600 font-medium">Riesgo medio</p>
              <p className="text-2xl font-bold text-amber-700">{eventosSeguidad.filter((e) => e.nivel === "medio").length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-green-600 font-medium">Riesgo bajo</p>
              <p className="text-2xl font-bold text-green-700">{eventosSeguidad.filter((e) => e.nivel === "bajo").length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filtroNivel} onValueChange={setFiltroNivel}>
          <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Nivel de riesgo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los niveles</SelectItem>
            <SelectItem value="alto">Riesgo alto</SelectItem>
            <SelectItem value="medio">Riesgo medio</SelectItem>
            <SelectItem value="bajo">Riesgo bajo</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-auto">{datos.length} eventos</span>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-xs font-semibold text-gray-600 w-40">Fecha / Hora</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Tipo de evento</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Usuario</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">IP</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Detalle</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 text-center">Riesgo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-400 py-10">
                  No hay eventos de seguridad registrados
                </TableCell>
              </TableRow>
            ) : (
              datos.map((e) => (
                <TableRow key={e.id} className="hover:bg-gray-50 text-sm">
                  <TableCell className="text-xs text-gray-500 font-mono">{e.fecha}</TableCell>
                  <TableCell className="font-medium text-gray-800">{e.tipo}</TableCell>
                  <TableCell className="text-gray-700">{e.usuario}</TableCell>
                  <TableCell className="font-mono text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Wifi className="h-3 w-3 text-gray-300" /> {e.ip}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-xs truncate">{e.detalle}</TableCell>
                  <TableCell className="text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${seguridadNivelColor[e.nivel]}`}>
                      {e.nivel.charAt(0).toUpperCase() + e.nivel.slice(1)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Monitoreo() {
  const { toast } = useToast();
  const { canViewDashboard } = usePermissions();
  const { errores, seguridad, refetch, exportLogs, isExporting } = useLogs();
  const [isAdmin] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user?.rol === "admin";
    } catch {
      return false;
    }
  });

  const handleActualizar = async () => {
    try {
      if (isAdmin && exportLogs) {
        await exportLogs();
        toast({ title: "Logs exportados", description: "Archivos JSONL actualizados manualmente" });
      }
      await refetch();
    } catch (error: any) {
      toast({
        title: "Error al actualizar",
        description: error?.message || "No se pudo actualizar el monitoreo",
        variant: "destructive",
      });
    }
  };

  if (!canViewDashboard) {
    return (
      <Layout title="Centro de Monitoreo" subtitle="Supervisión y control del sistema">
        <div className="p-6 text-center text-gray-500">No tienes permiso para ver esta sección.</div>
      </Layout>
    );
  }

  return (
    <Layout title="Centro de Monitoreo" subtitle="Supervisión y control del sistema">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Centro de Monitoreo</h1>
            <p className="text-sm text-gray-500 mt-0.5">Supervisión en tiempo real del sistema</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-sm"
            onClick={handleActualizar}
            disabled={isExporting}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isExporting ? "animate-spin" : ""}`} />
            {isExporting ? "Exportando..." : "Actualizar"}
          </Button>
        </div>

        {/* Pestañas */}
        <Tabs defaultValue="general">
          <TabsList className="bg-gray-100 p-1 rounded-lg h-auto">
            <TabsTrigger value="general"   className="text-sm px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              Vista General
            </TabsTrigger>
            <TabsTrigger value="actividad" className="text-sm px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              Actividad
            </TabsTrigger>
            <TabsTrigger value="errores"   className="text-sm px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
              Errores
              <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {errores.filter((e) => !e.revisado).length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="seguridad" className="text-sm px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
              Seguridad
              <span className="bg-amber-100 text-amber-600 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {seguridad.filter((e) => e.nivel === "alto").length}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-5">
            <TabsContent value="general">  <TabGeneral />   </TabsContent>
            <TabsContent value="actividad"><TabActividad /> </TabsContent>
            <TabsContent value="errores">  <TabErrores />   </TabsContent>
            <TabsContent value="seguridad"><TabSeguridad /></TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
