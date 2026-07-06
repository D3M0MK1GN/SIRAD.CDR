import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DetailField } from "@/components/ui/detail-field";
import {
  Eye,
  Edit,
  Trash2,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  CheckCircle,
  Clock,
  QrCode,
  FileText,
  Download,
  Printer,
  FilePlus,
  MessageSquare,
  Files,
  Bug,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { type Experticia } from "@shared/schema";
import { type Permission } from "@/hooks/use-permissions";
import {
  formatOperator,
  formatStatus,
  OPERATOR_COLORS,
  STATUS_COLORS,
  downloadFile,
  OPERATORS,
  STATUSES,
  EXPERTICIA_TYPES,
} from "@/lib/experticia-utils";
import { CombinarArchivosModal } from "./combinar-archivos-modal";

interface ExperticiasTableProps {
  experticias: Experticia[];
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onFiltersChange: (filters: any) => void;
  onEdit: (experticia: Experticia) => void;
  onDelete: (id: number) => void;
  onView: (experticia: Experticia) => void;
  onCreateNew: () => void;
  onDuplicate: (experticia: Experticia) => void;
  onExportExcel: () => void;
  loading?: boolean;
  permissions: Permission;
}

const statsConfig = [
  {
    estado: "completada",
    label: "Completadas",
    icon: CheckCircle,
    color: "green",
  },
  { estado: "procesando", label: "Procesando", icon: Clock, color: "yellow" },
  { estado: "qr_ausente", label: "QR Ausente", icon: QrCode, color: "orange" },
];

export function ExperticiasTable({
  experticias,
  total,
  currentPage,
  pageSize,
  onPageChange,
  onFiltersChange,
  onEdit,
  onDelete,
  onView,
  onCreateNew,
  onDuplicate,
  onExportExcel,
  loading = false,
  permissions,
}: ExperticiasTableProps) {
  // Estado local: controla los filtros activos (búsqueda, operador, estado, tipo)
  const [filters, setFilters] = useState({
    operador: "all",
    estado: "all",
    tipoExperticia: "all",
    search: "",
  });

  // Estado local: experticia actualmente visualizada en el modal de detalles
  const [viewingExperticia, setViewingExperticia] = useState<Experticia | null>(
    null
  );

  // Estado local: controla visibilidad del menú flotante (Chat, Combinar, Rastrear)
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Estado local: controla visibilidad del modal para combinar archivos
  const [isCombinarModalOpen, setIsCombinarModalOpen] = useState(false);

  /**
   * Activa la impresión del navegador para el documento actualmente visible
   */
  const handlePrint = () => {
    window.print();
  };

  /**
   * Descarga un documento Word con los datos de la experticia seleccionada
   * Usa el tipo de experticia para obtener la plantilla correcta
   */
  const handleGenerateDocument = async () => {
    if (!viewingExperticia) return;
    try {
      await downloadFile(
        `/api/plantillas-word/experticia/${viewingExperticia.tipoExperticia}/generate`,
        `experticia-${viewingExperticia.numeroDictamen}.docx`,
        {
          authorization: `Bearer ${localStorage.getItem("token")}`,
          body: {
            ...viewingExperticia,
            experticiaid: viewingExperticia.id,
            datosAnalisis: viewingExperticia.datosAnalisis,
          },
        }
      );
    } catch (error) {
      console.error("Error generando documento:", error);
    }
  };

  /**
   * Actualiza los filtros y notifica al padre (componente de gestión)
   * para que recargue las experticias filtradas
   */
  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Calcula el número total de páginas para la paginación
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: Cards de estadísticas
          Muestra el total de experticias y un desglose por estado
          Actualiza dinámicamente según los datos actuales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={BarChart3} label="Total" count={total} color="blue" />
        {statsConfig.map((stat) => (
          <StatCard
            key={stat.estado}
            icon={stat.icon}
            label={stat.label}
            count={experticias.filter((e) => e.estado === stat.estado).length}
            color={stat.color}
          />
        ))}
      </div>

      {/* SECCIÓN 2: Panel de filtros, búsqueda y acciones principales
          Permite filtrar por: texto, tipo, operador, estado
          Botones: Exportar Excel, Nueva Experticia (si hay permisos) */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <CardTitle className="text-xl font-semibold">
              Gestión de Experticias
            </CardTitle>
            <div className="flex gap-2">
              {permissions.canCreateExperticias && (
                <Button
                  onClick={onExportExcel}
                  variant="outline"
                  className="bg-green-50 text-green-700 hover:bg-green-100"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
              )}
              {permissions.canCreateExperticias && (
                <Button onClick={onCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Experticia
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controles de búsqueda y filtrado
              Cambios en estos selects/inputs disparan handleFilterChange
              que notifica al padre para actualizar los datos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por N° dictamen o expediente..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.tipoExperticia}
              onValueChange={(value) =>
                handleFilterChange(
                  "tipoExperticia",
                  value === "all" ? "" : value
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                sideOffset={4}
                alignOffset={0}
                avoidCollisions={false}
              >
                <SelectItem value="all">
                  Todos los tipos de experticia
                </SelectItem>
                {EXPERTICIA_TYPES.slice(0, 11).map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.operador}
              onValueChange={(value) =>
                handleFilterChange("operador", value === "all" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los operadores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los operadores</SelectItem>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.estado}
              onValueChange={(value) =>
                handleFilterChange("estado", value === "all" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {STATUSES.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center text-sm text-gray-600">
              {loading ? "Cargando..." : ""}
            </div>
          </div>

          {/* SECCIÓN 3: Tabla de experticias
              Columnas: Nº Dictamen, Expediente, Operador, Tipo, Nº Comunicación, Fecha, Estado
              Última columna: Botones de acción (Ver, Editar, Duplicar, Eliminar) */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Dictamen</TableHead>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Tipo Experticia</TableHead>
                  <TableHead>Nº Comunicación</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Renderiza cada experticia como una fila
                    Códigos de color: Operador y Estado usan colores predefinidos
                    Acciones disponibles dependen de permisos del usuario */}
                {experticias.map((experticia) => (
                  <TableRow key={experticia.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="font-mono text-sm">
                          {experticia.numeroDictamen}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {experticia.expediente}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          OPERATOR_COLORS[experticia.operador] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {formatOperator(experticia.operador)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <span className="font-medium truncate">
                          {experticia.tipoExperticia}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {experticia.numeroComunicacion}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {experticia.fechaComunicacion || "Sin fecha"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          STATUS_COLORS[
                            experticia.estado as keyof typeof STATUS_COLORS
                          ]
                        }
                      >
                        {formatStatus(experticia.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Botón Ver: siempre disponible - abre modal de detalles */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingExperticia(experticia)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {/* Botones de edición: solo si usuario tiene permisos canManageUsers */}
                        {permissions.canManageUsers && (
                          <>
                            {/* Duplicar: crea copia de la experticia */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDuplicate(experticia)}
                              title="Duplicar Experticia"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <FilePlus className="h-4 w-4" />
                            </Button>
                            {/* Editar: abre formulario de edición */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(experticia)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {/* Eliminar: borra la experticia (requiere confirmación en padre) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(experticia.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* SECCIÓN 4: Paginación
              Solo se muestra si hay más de una página
              Navega entre páginas: Anterior/Siguiente */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              {/* Texto informativo: cuántos registros se están mostrando */}
              <p className="text-sm text-gray-700">
                Mostrando {(currentPage - 1) * pageSize + 1} a{" "}
                {Math.min(currentPage * pageSize, total)} de {total} experticias
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECCIÓN 5: Modal de detalles
          Se abre cuando usuario hace clic en botón "Ver"
          Muestra toda la información de la experticia seleccionada
          Incluye botones: Imprimir, Generar Documento (Word) */}
      <Dialog
        open={!!viewingExperticia}
        onOpenChange={() => setViewingExperticia(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-x-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>Detalles de Experticia</span>
              </div>
              {/* Botones de exportación disponibles en el modal */}
              <div className="flex gap-2">
                {/* Imprimir: activa diálogo del navegador para imprimir el modal */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="no-print"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Reporte
                </Button>
                {/* Generar Documento: descarga un archivo Word con datos de la experticia */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateDocument}
                  className="no-print"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generar Documento
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {/* Contenido del modal: secciones con información detallada */}
          {viewingExperticia && (
            <div className="space-y-6 px-6 pb-6 max-h-[60vh] overflow-y-auto">
              {/* Información básica */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">
                  Información Básica
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailField
                    label="Nº Dictamen"
                    value={viewingExperticia.numeroDictamen}
                    isMono
                  />
                  <DetailField
                    label="Expediente"
                    value={viewingExperticia.expediente}
                    isMono
                  />
                  <DetailField
                    label="Experto"
                    value={viewingExperticia.experto}
                  />
                  <DetailField
                    label="Nº Comunicación"
                    value={viewingExperticia.numeroComunicacion}
                    isMono
                  />
                </div>
              </div>

              {/* Fechas */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Fechas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailField
                    label="Fecha Comunicación"
                    value={viewingExperticia.fechaComunicacion?.toString()}
                    isDate
                  />
                  <DetailField
                    label="Fecha Respuesta"
                    value={viewingExperticia.fechaRespuesta?.toString()}
                    isDate
                  />
                </div>
              </div>

              {/* Detalles de la experticia */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">
                  Detalles de la Experticia
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailField
                    label="Operador"
                    value={viewingExperticia.operador ?? ""}
                    isBadge
                    badgeVariant="outline"
                    badgeClassName="capitalize"
                  />
                  <DetailField
                    label="Tipo de Experticia"
                    value={viewingExperticia.tipoExperticia ?? ""}
                  />
                  <DetailField
                    label="Estado"
                    value={formatStatus(viewingExperticia.estado) ?? ""}
                    isBadge
                    badgeClassName={String(
                      STATUS_COLORS[
                        viewingExperticia.estado as keyof typeof STATUS_COLORS
                      ] ?? "bg-gray-100 text-gray-800"
                    )}
                  />
                </div>
                <DetailField
                  label="Motivo"
                  value={viewingExperticia.motivo ?? ""}
                />
              </div>

              {/* Información del abonado */}
              {(viewingExperticia.abonado ||
                viewingExperticia.datosAbonado) && (
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900">
                    Información del Abonado
                  </h4>
                  <div className="space-y-4">
                    {viewingExperticia.abonado && (
                      <DetailField
                        label="Abonado"
                        value={viewingExperticia.abonado}
                      />
                    )}
                    {viewingExperticia.datosAbonado && (
                      <DetailField
                        label="Datos del Abonado"
                        value={viewingExperticia.datosAbonado}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Archivo y conclusión */}
              {(viewingExperticia.archivoAdjunto ||
                viewingExperticia.conclusion) && (
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900">
                    Documentación y Resultados
                  </h4>
                  <div className="space-y-4">
                    {viewingExperticia.archivoAdjunto && (
                      <DetailField
                        label="Archivo Adjunto"
                        value={viewingExperticia.archivoAdjunto}
                      />
                    )}
                    {viewingExperticia.conclusion && (
                      <DetailField
                        label="Conclusión"
                        value={viewingExperticia.conclusion}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Tabla de datos seleccionados */}
              {viewingExperticia.datosSeleccionados &&
                Array.isArray(viewingExperticia.datosSeleccionados) &&
                viewingExperticia.datosSeleccionados.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-900">
                      Datos Seleccionados (
                      {viewingExperticia.datosSeleccionados.length} registros)
                    </h4>
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
                          {(viewingExperticia.datosSeleccionados as any[]).map(
                            (fila, index) => (
                              <TableRow key={index}>
                                <TableCell className="py-1 px-2 text-xs">
                                  {fila["ABONADO A"] || fila.ABONADO_A || "-"}
                                </TableCell>
                                <TableCell className="py-1 px-2 text-xs">
                                  {fila["ABONADO B"] || fila.ABONADO_B || "-"}
                                </TableCell>
                                <TableCell className="py-1 px-2 text-xs">
                                  {fila.FECHA || "-"}
                                </TableCell>
                                <TableCell className="py-1 px-2 text-xs">
                                  {fila.HORA || "-"}
                                </TableCell>
                                <TableCell className="py-1 px-2 text-xs">
                                  {fila.TIME || "-"}
                                </TableCell>
                                <TableCell className="py-1 px-2 text-xs">
                                  {fila.DIRECCION || "-"}
                                </TableCell>
                                <TableCell className="py-1 px-2 text-xs">
                                  {fila.CORDENADAS || "-"}
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <DetailField
                  label="Fecha de Creación"
                  value={viewingExperticia.createdAt?.toString()}
                  isDate
                />
                <DetailField
                  label="Última Actualización"
                  value={viewingExperticia.updatedAt?.toString()}
                  isDate
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SECCIÓN 6: Menú flotante (botón +)
          Acciones secundarias: Chat, Combinar Archivos, Rastrear (Araña)
          Se despliega/oculta al hacer clic en el botón redondo azul */}
      <div className="fixed bottom-4 right-3 z-50">
        {/* Menú desplegable: solo visible si isMenuOpen es true */}
        {isMenuOpen && (
          <div
            className="absolute bottom-12 right-5 bg-white rounded-lg shadow-lg border border-gray-200 py-2 w-56 mb-2"
            data-testid="menu-flotante"
          >
            {/* Opción 1: Abre funcionalidad de chat */}
            <button
              onClick={() => setIsMenuOpen(false)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors"
              data-testid="button-chat"
            >
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium">Chat</span>
            </button>
            {/* Opción 2: Abre modal para combinar archivos de experticias */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsCombinarModalOpen(true);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors"
              data-testid="button-combinar-archivos"
            >
              <Files className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">Combinar Archivos</span>
            </button>
            {/* Opción 3: Funcionalidad de rastreo/análisis (Araña) */}
            <button
              onClick={() => setIsMenuOpen(false)}
              className="w-full px-4 py-3 text-left hover:bg-purple-100 bg-purple-50 flex items-center space-x-3 transition-colors relative"
              data-testid="button-rastrear"
            >
              <Bug className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium">Rastrear (Araña)</span>
            </button>
          </div>
        )}
        {/* Botón principal del menú: gira 45° cuando está abierto */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:scale-110"
          data-testid="button-menu-flotante"
        >
          <Plus
            className={`h-6 w-6 transition-transform ${
              isMenuOpen ? "rotate-45" : ""
            }`}
          />
        </button>
      </div>

      <CombinarArchivosModal
        isOpen={isCombinarModalOpen}
        onClose={() => setIsCombinarModalOpen(false)}
      />
    </div>
  );
}
