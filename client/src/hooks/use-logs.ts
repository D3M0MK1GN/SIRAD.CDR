/**
 * Hook para consumir el sistema de logs híbrido en el Centro de Monitoreo.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";


const formatFecha = (date: string | Date) =>
  format(new Date(date), "dd/MM/yyyy HH:mm");

export interface LogActividadUI {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
  modulo: string;
  ip: string;
  resultado: string;
}

export interface LogErrorUI {
  id: number;
  fecha: string;
  nivel: string;
  servicio: string;
  mensaje: string;
  endpoint: string;
  revisado: boolean;
  detalle: string;
}

export interface LogSeguridadUI {
  id: number;
  fecha: string;
  tipo: string;
  usuario: string;
  ip: string;
  detalle: string;
  nivel: string;
}

export interface MetricaUI {
  label: string;
  valor: number;
}

interface RawLogResponse {
  success: boolean;
  data: any[];
}

function sinceParam(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return `?since=${d.toISOString()}`;
}

function mapActividad(row: any): LogActividadUI {
  return {
    id: row.id,
    fecha: formatFecha(row.createdAt),
    usuario: row.username || "Sistema",
    accion: row.accion,
    modulo: row.modulo,
    ip: row.ip || "-",
    resultado: row.resultado,
  };
}

function mapError(row: any): LogErrorUI {
  return {
    id: row.id,
    fecha: formatFecha(row.createdAt),
    nivel: row.severityLabel === "critical" ? "critical" : row.severityLabel === "error" ? "error" : "warn",
    servicio: row.servicio,
    mensaje: row.mensaje,
    endpoint: row.endpoint || "Sistema",
    revisado: row.revisado ?? false,
    detalle: row.detalle || row.mensaje,
  };
}

function mapSeguridad(row: any): LogSeguridadUI {
  return {
    id: row.id,
    fecha: formatFecha(row.createdAt),
    tipo: row.tipo,
    usuario: row.username || "Sistema",
    ip: row.ip || "-",
    detalle: row.detalle || "-",
    nivel: row.nivel,
  };
}

export function useLogs(sinceHours = 24) {
  const queryClient = useQueryClient();

  const actividad = useQuery<RawLogResponse>({
    queryKey: ["/api/logs/actividad", sinceHours],
    queryFn: () => apiRequest(`/api/logs/actividad${sinceParam(sinceHours)}`),
    refetchInterval: 60 * 1000, // 1 minuto
  });

  const errores = useQuery<RawLogResponse>({
    queryKey: ["/api/logs/errores", sinceHours],
    queryFn: () => apiRequest(`/api/logs/errores${sinceParam(sinceHours)}`),
    refetchInterval: 60 * 1000,
  });

  const seguridad = useQuery<RawLogResponse>({
    queryKey: ["/api/logs/seguridad", sinceHours],
    queryFn: () => apiRequest(`/api/logs/seguridad${sinceParam(sinceHours)}`),
    refetchInterval: 60 * 1000,
  });

  const metricas = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/metricas", sinceHours],
    queryFn: () => apiRequest(`/api/metricas${sinceParam(sinceHours)}`),
    refetchInterval: 60 * 1000,
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/admin/logs/export", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logs/actividad"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs/errores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs/seguridad"] });
    },
  });

  const actividadData = (actividad.data?.data || []).map(mapActividad);
  const erroresData = (errores.data?.data || []).map(mapError);
  const seguridadData = (seguridad.data?.data || []).map(mapSeguridad);
  const metricasData = metricas.data?.data || [];

  const isLoading =
    actividad.isLoading || errores.isLoading || seguridad.isLoading || metricas.isLoading;

  return {
    actividad: actividadData,
    errores: erroresData,
    seguridad: seguridadData,
    metricas: metricasData,
    isLoading,
    refetch: () => {
      actividad.refetch();
      errores.refetch();
      seguridad.refetch();
      metricas.refetch();
    },
    exportLogs: exportMutation.mutateAsync,
    isExporting: exportMutation.isPending,
  };
}

export function buildChartData(
  metricas: any[],
  tipo: "actividad" | "trazabilidad",
  periodo: "24h" | "72h" | "rango",
  rango?: DateRange
): MetricaUI[] {
  const filtradas = metricas.filter((m) => m.tipo === tipo);

  if (filtradas.length === 0) {
    return [];
  }

  if (periodo === "rango" && rango?.from && rango?.to) {
    const desde = new Date(rango.from);
    const hasta = new Date(rango.to);
    const porDia: Record<string, number> = {};
    for (const m of filtradas) {
      const fecha = new Date(m.fecha);
      if (fecha >= desde && fecha <= hasta) {
        const key = format(fecha, "dd/MM");
        porDia[key] = (porDia[key] || 0) + m.conteo;
      }
    }
    return Object.entries(porDia).map(([label, valor]) => ({ label, valor }));
  }

  const horas = periodo === "24h" ? 24 : 72;
  const ahora = new Date();
  const inicio = new Date(ahora.getTime() - horas * 60 * 60 * 1000);
  const porHora: Record<string, number> = {};

  // Inicializar todas las horas en 0 para que el gráfico no quede vacío en huecos
  for (let i = 0; i < horas; i++) {
    const t = new Date(inicio.getTime() + i * 60 * 60 * 1000);
    const key = format(t, "HH:00");
    porHora[key] = 0;
  }

  for (const m of filtradas) {
    const fecha = new Date(m.fecha);
    if (fecha >= inicio && fecha <= ahora) {
      const key = format(fecha, "HH:00");
      porHora[key] = (porHora[key] || 0) + m.conteo;
    }
  }

  return Object.entries(porHora).map(([label, valor]) => ({ label, valor }));
}
