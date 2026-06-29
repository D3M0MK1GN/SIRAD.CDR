import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { useSidebarContext } from "@/hooks/use-sidebar-context";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Activity,
  User,
  Phone,
  GitMerge,
  Info,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Upload,
  Edit,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CargarDatosModal } from "@/components/cargar-datos-modal";
import { Textarea } from "@/components/ui/textarea";

interface ResultadoBusqueda {
  id: number;
  personaId: number | null;
  expediente: string;
  cedula: string;
  nombreCompleto: string;
  numeroAsociado: string;
  delito: string;
  fechaRegistro: string;
}

export default function Trazabilidad() {
  const { isOpen } = useSidebarContext();
  const { toast } = useToast();
  const [tipoBusqueda, setTipoBusqueda] = useState<string>("cedula");
  const [valorBusqueda, setValorBusqueda] = useState<string>("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estados para modales
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showRegistrosModal, setShowRegistrosModal] = useState(false);
  const [showCoincidenciasModal, setShowCoincidenciasModal] = useState(false);
  const [showAnalisisModal, setShowAnalisisModal] = useState(false);
  const [showCargarDatosModal, setShowCargarDatosModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Datos de los modales
  const [personaData, setPersonaData] = useState<any>(null);
  const [registrosData, setRegistrosData] = useState<any[]>([]);
  const [coincidenciasData, setCoincidenciasData] = useState<any>(null);
  const [analisisData, setAnalisisData] = useState<any>(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editRegistros, setEditRegistros] = useState<any[]>([]);
  const [archivoNuevoRegistro, setArchivoNuevoRegistro] = useState<File | null>(
    null
  );
  const [isUploadingRegistro, setIsUploadingRegistro] = useState(false);

  // Estados para tabla de registros
  const [filtroGlobal, setFiltroGlobal] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoEvento, setTipoEvento] = useState("todos");
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(50);


  const handleSearch = async () => {
    setIsSearching(true);

    try {
      const response = await fetch(
        `/api/trazabilidad/buscar?tipo=${tipoBusqueda}&valor=${encodeURIComponent(
          valorBusqueda
        )}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResultados(data.resultados || []);
        if (data.total === 0) {
          toast({
            title: "Sin resultados",
            description:
              "No se encontraron registros con los criterios especificados",
            variant: "default",
          });
        }
      } else {
        setResultados([]);
        toast({
          title: "Error",
          description: "No se pudo realizar la búsqueda",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al buscar:", error);
      setResultados([]);
      toast({
        title: "Error",
        description: "Ocurrió un error al buscar",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleInfoPersona = async (personaId: number) => {
    // Limpiar datos anteriores antes de abrir el modal
    setPersonaData(null);
    setLoadingModal(true);
    setShowPersonaModal(true);

    try {
      const response = await fetch(`/api/expedientes-sujetos/${personaId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPersonaData(data);
      } else {
        setShowPersonaModal(false);
        toast({
          title: "Error",
          description: "No se pudo obtener la información de la persona",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al obtener información de persona:", error);
      setShowPersonaModal(false);
      toast({
        title: "Error",
        description: "No se pudo obtener la información de la persona",
        variant: "destructive",
      });
    } finally {
      setLoadingModal(false);
    }
  };

  const handleVerRegistros = async (numero: string) => {
    // Limpiar datos anteriores y filtros antes de abrir el modal
    setRegistrosData([]);
    setFiltroGlobal("");
    setFechaInicio("");
    setFechaFin("");
    setTipoEvento("todos");
    setPaginaActual(1);
    setLoadingModal(true);
    setShowRegistrosModal(true);

    try {
      const response = await fetch(
        `/api/registros-comunicacion/abonado/${encodeURIComponent(numero)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRegistrosData(data);
      } else {
        setShowRegistrosModal(false);
        toast({
          title: "Error",
          description: "No se pudieron obtener los registros de comunicación",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al obtener registros:", error);
      setShowRegistrosModal(false);
      toast({
        title: "Error",
        description: "No se pudieron obtener los registros de comunicación",
        variant: "destructive",
      });
    } finally {
      setLoadingModal(false);
    }
  };

  // Función para filtrar registros
  const getRegistrosFiltrados = () => {
    let filtrados = [...registrosData];

    // Filtro global
    if (filtroGlobal.trim()) {
      const busqueda = filtroGlobal.toLowerCase();
      filtrados = filtrados.filter((reg) =>
        Object.values(reg).some((val) =>
          String(val).toLowerCase().includes(busqueda)
        )
      );
    }

    // Filtro por fecha sin zona horaria: convierte todo a "YYYYMMDD" para comparar strings
    // reg.fecha viene como "DD/MM/YYYY" desde la DB
    // fechaInicio/fechaFin vienen como "YYYY-MM-DD" del input type="date"
    const toYYYYMMDD = (ddmmyyyy: string): string => {
      const p = ddmmyyyy.split('/');
      if (p.length !== 3 || !p[2]) return '';
      return `${p[2]}${p[1].padStart(2,'0')}${p[0].padStart(2,'0')}`;
    };
    if (fechaInicio) {
      const inicioStr = fechaInicio.replace(/-/g, ''); // "2025-12-02" → "20251202"
      filtrados = filtrados.filter((reg) => {
        const regStr = toYYYYMMDD(reg.fecha || '');
        return regStr ? regStr >= inicioStr : false;
      });
    }
    if (fechaFin) {
      const finStr = fechaFin.replace(/-/g, ''); // "2025-12-03" → "20251203"
      filtrados = filtrados.filter((reg) => {
        const regStr = toYYYYMMDD(reg.fecha || '');
        return regStr ? regStr <= finStr : false;
      });
    }

    // Filtro por tipo de evento
    if (tipoEvento !== "todos") {
      filtrados = filtrados.filter((reg) =>
        reg.tipoTransaccion?.toLowerCase().includes(tipoEvento.toLowerCase())
      );
    }

    return filtrados;
  };

  // Función para exportar a CSV
  const exportarRegistrosCSV = () => {
    const registrosFiltrados = getRegistrosFiltrados();
    if (registrosFiltrados.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay registros para exportar",
        variant: "default",
      });
      return;
    }

    const headers = [
      "Abonado A",
      "Abonado B",
      "Fecha",
      "Hora",
      "Tipo Transacción",
      "Time",
      "BTS-Celda",
      "BTS-Celda A",
      "BTS-Celda B",
      "Dirección A",
      "Dirección B",
      "Coordenadas A",
      "Coordenadas B",
      "Orientación A",
      "Orientación B",
      "IMEI A",
      "IMEI B",
      "Archivo",
      "Peso",
    ];

    const rows = registrosFiltrados.map((reg) => [
      reg.abonadoA || "",
      reg.abonadoB || "",
      reg.fecha || "",
      reg.hora || "",
      reg.tipoTransaccion || "",
      reg.time || "",
      reg.btsCelda || "",
      reg.btsCeldaA || "",
      reg.btsCeldaB || "",
      reg.direccionA || "",
      reg.direccionB || "",
      reg.coordenadasA || "",
      reg.coordenadasB || "",
      reg.orientacionA || "",
      reg.orientacionB || "",
      reg.imeiA || "",
      reg.imeiB || "",
      reg.archivo || "",
      reg.peso || "",
    ]);

    const csvContent =
      headers.join(",") +
      "\n" +
      rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `registros_comunicacion_${new Date().getTime()}.csv`;
    link.click();

    toast({
      title: "Exportación exitosa",
      description: `Se exportaron ${registrosFiltrados.length} registros`,
    });
  };

  // Función para iniciar análisis de un contacto
  const handleAnalizarContacto = (numeroContacto: string) => {
    if (
      confirm(
        `¿Desea iniciar un nuevo análisis para el número ${numeroContacto}?`
      )
    ) {
      setShowRegistrosModal(false);
      handleAnalizarTraza(numeroContacto);
    }
  };

  const handleCoincidencias = async (numero: string) => {
    // Limpiar datos anteriores antes de abrir el modal
    setCoincidenciasData(null);
    setLoadingModal(true);
    setShowCoincidenciasModal(true);

    try {
      const response = await fetch(
        `/api/trazabilidad/coincidencias/${encodeURIComponent(numero)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCoincidenciasData(data);
      } else {
        // En caso de error, cerrar el modal
        setShowCoincidenciasModal(false);
        toast({
          title: "Error",
          description: "No se pudieron obtener las coincidencias",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al obtener coincidencias:", error);
      // En caso de error, cerrar el modal
      setShowCoincidenciasModal(false);
      toast({
        title: "Error",
        description: "No se pudieron obtener las coincidencias",
        variant: "destructive",
      });
    } finally {
      setLoadingModal(false);
    }
  };

  const handleAnalizarTraza = async (numero: string) => {
    setAnalisisData(null);
    setLoadingModal(true);
    setShowAnalisisModal(true);

    try {
      const response = await fetch(
        `/api/analisis-traza/${encodeURIComponent(numero)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalisisData({ ...data, numeroAnalizado: numero });
      } else {
        setShowAnalisisModal(false);
        toast({
          title: "Error",
          description: "No se pudo realizar el análisis de trazabilidad",
          variant: "destructive",
        });
      }
    } catch (error) {
      setShowAnalisisModal(false);
      toast({
        title: "Error",
        description: "No se pudo realizar el análisis de trazabilidad",
        variant: "destructive",
      });
    } finally {
      setLoadingModal(false);
    }
  };

  const handleEdit = async (personaId: number) => {
    setEditData(null);
    setEditRegistros([]);
    setArchivoNuevoRegistro(null);
    setLoadingModal(true);
    setShowEditModal(true);

    try {
      const response = await fetch(`/api/expedientes-sujetos/${personaId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEditData(data);

        // Cargar registros comunicacionales si hay un teléfono
        if (data.telefono) {
          const registrosResponse = await fetch(
            `/api/registros-comunicacion/abonado/${encodeURIComponent(
              data.telefono
            )}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          );

          if (registrosResponse.ok) {
            const registrosData = await registrosResponse.json();
            setEditRegistros(registrosData);
          }
        }
      } else {
        setShowEditModal(false);
        toast({
          title: "Error",
          description: "No se pudo obtener la información para editar",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al obtener datos para editar:", error);
      setShowEditModal(false);
      toast({
        title: "Error",
        description: "No se pudo obtener la información para editar",
        variant: "destructive",
      });
    } finally {
      setLoadingModal(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editData) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/expedientes-sujetos/${editData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Persona/Caso actualizado correctamente",
        });
        setShowEditModal(false);
        handleSearch();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "No se pudo actualizar la persona/caso",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al actualizar:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al actualizar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllRegistros = async () => {
    if (!editData?.telefono) {
      toast({
        title: "Error",
        description: "No hay un teléfono asociado",
        variant: "destructive",
      });
      return;
    }

    if (
      !confirm(
        "¿Está seguro que desea eliminar todos los registros comunicacionales de este número?"
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/registros-comunicacion/abonado/${encodeURIComponent(
          editData.telefono
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Todos los registros fueron eliminados correctamente",
        });
        setEditRegistros([]);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "No se pudo eliminar los registros",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al eliminar registros:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al eliminar los registros",
        variant: "destructive",
      });
    }
  };

  const handleUploadRegistros = async () => {
    if (!archivoNuevoRegistro) {
      toast({
        title: "Archivo requerido",
        description: "Por favor selecciona un archivo para importar",
        variant: "destructive",
      });
      return;
    }

    if (!editData?.telefono) {
      toast({
        title: "Teléfono requerido",
        description:
          "La persona/caso debe tener un número de teléfono asociado",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingRegistro(true);
    const formDataToSend = new FormData();
    formDataToSend.append("archivo", archivoNuevoRegistro);
    formDataToSend.append("numeroAsociado", editData.telefono);

    try {
      const response = await fetch("/api/registros-comunicacion/importar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Importación exitosa",
          description: `Se importaron ${data.registrosImportados} registros correctamente`,
        });
        setArchivoNuevoRegistro(null);

        // Recargar registros
        const registrosResponse = await fetch(
          `/api/registros-comunicacion/abonado/${encodeURIComponent(
            editData.telefono
          )}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (registrosResponse.ok) {
          const registrosData = await registrosResponse.json();
          setEditRegistros(registrosData);
        }
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "No se pudo importar el archivo",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al importar registros:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al importar los registros",
        variant: "destructive",
      });
    } finally {
      setIsUploadingRegistro(false);
    }
  };

  const handleDelete = async (expedienteId: number, personaId: number | null, nombreCompleto: string) => {
    if (
      !confirm(
        `¿Está seguro que desea eliminar el registro de ${nombreCompleto}?`
      )
    ) {
      return;
    }

    try {
      // Si tiene personaId (persona registrada), eliminar la persona completa (cascade elimina sus expedientes)
      // Si no (resultado de experticia), solo eliminar el expediente
      const url = personaId
        ? `/api/personas-casos/${personaId}`
        : `/api/expedientes-sujetos/${expedienteId}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Registro eliminado correctamente",
        });
        // Filtrar todos los resultados de la misma persona o el expediente específico
        setResultados(resultados.filter((r) =>
          personaId ? r.personaId !== personaId : r.id !== expedienteId
        ));
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "No se pudo eliminar la persona/caso",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al eliminar:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al eliminar",
        variant: "destructive",
      });
    }
  };

  // ── Datos del modal de Análisis de Traza (vienen del backend Python) ──
  const contactosFrecuentes: Record<string, any>[] = analisisData?.contactosFrecuentes ?? [];
  const imeis: { imei: string; cantidad: number }[] = analisisData?.imeis ?? [];
  const georref: { frecTotalFisica: number | string; frecPorCelda: number; btsCelda: string; direccion: string; coordenadas: string; orientacion: string }[] = analisisData?.georref ?? [];
  // Tipos de transacción dinámicos (columnas extra en contactosFrecuentes)
  const tiposColumnas: string[] = contactosFrecuentes.length > 0
    ? Object.keys(contactosFrecuentes[0]).filter(k => !["numero","frecuencia","primera_fecha","ultima_fecha"].includes(k))
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div
        className={cn(
          "transition-all duration-300",
          isOpen ? "ml-64" : "ml-16"
        )}
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="h-8 w-8 text-primary" />
              Análisis de Trazabilidad
            </h1>
            <p className="text-gray-600 mt-2">
              Busca y analiza la trazabilidad de personas, números telefónicos y
              expedientes
            </p>
          </div>

          {/* Búsqueda */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Buscar Información</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Select value={tipoBusqueda} onValueChange={setTipoBusqueda}>
                    <SelectTrigger data-testid="select-tipo-busqueda">
                      <SelectValue placeholder="Seleccionar tipo de búsqueda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cedula">Cédula</SelectItem>
                      <SelectItem value="nombre">Nombre</SelectItem>
                      <SelectItem value="seudonimo">Seudónimo</SelectItem>
                      <SelectItem value="numero">Número Telefónico</SelectItem>
                      <SelectItem value="expediente">Expediente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-[2]">
                  <Input
                    data-testid="input-busqueda"
                    type="text"
                    placeholder={`Ingrese ${
                      tipoBusqueda === "cedula"
                        ? "la cédula"
                        : tipoBusqueda === "nombre"
                        ? "el nombre"
                        : tipoBusqueda === "seudonimo"
                        ? "el seudónimo"
                        : tipoBusqueda === "numero"
                        ? "el número"
                        : "el expediente"
                    }`}
                    value={valorBusqueda}
                    onChange={(e) => setValorBusqueda(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && valorBusqueda.trim()) {
                        handleSearch();
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid="button-cargar-datos"
                    onClick={() => setShowCargarDatosModal(true)}
                    variant="outline"
                    className="w-full md:w-auto"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Cargar Datos
                  </Button>
                  <Button
                    data-testid="button-buscar"
                    onClick={handleSearch}
                    disabled={!valorBusqueda.trim() || isSearching}
                    className="w-full md:w-auto"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {isSearching ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultados - Tabla Maestra */}
          <Card>
            <CardHeader>
              <CardTitle>
                Resultados de la Búsqueda ({resultados.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resultados.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No hay resultados</p>
                  <p className="text-sm mt-2">
                    {valorBusqueda.trim()
                      ? "No se encontraron registros con los criterios especificados"
                      : "Utiliza el campo de búsqueda para encontrar información"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Expediente</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Número Asociado</TableHead>
                        <TableHead>Delito</TableHead>
                        <TableHead>Fecha Registro</TableHead>
                        <TableHead className="text-center w-[300px]">
                          Acciones
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultados.map((resultado, index) => (
                        <TableRow
                          key={index}
                          data-testid={`row-resultado-${index}`}
                        >
                          <TableCell
                            data-testid={`text-expediente-${index}`}
                            className="font-medium"
                          >
                            {resultado.expediente}
                          </TableCell>
                          <TableCell data-testid={`text-cedula-${index}`}>
                            {resultado.cedula}
                          </TableCell>
                          <TableCell data-testid={`text-nombre-${index}`}>
                            {resultado.nombreCompleto}
                          </TableCell>
                          <TableCell data-testid={`text-numero-${index}`}>
                            {resultado.numeroAsociado}
                          </TableCell>
                          <TableCell data-testid={`text-delito-${index}`}>
                            {resultado.delito}
                          </TableCell>
                          <TableCell data-testid={`text-fecha-${index}`}>
                            {resultado.fechaRegistro
                              ? new Date(resultado.fechaRegistro).toLocaleDateString("es-ES", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 justify-center">
                              <Button
                                data-testid={`button-analizar-${index}`}
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleAnalizarTraza(resultado.numeroAsociado)
                                }
                                title="Analizar Traza"
                              >
                                <Activity className="h-3 w-3" />
                              </Button>
                              <Button
                                data-testid={`button-info-${index}`}
                                size="sm"
                                variant="outline"
                                onClick={() => handleInfoPersona(resultado.id)}
                                title="Info Persona/Caso"
                              >
                                <User className="h-3 w-3" />
                              </Button>
                              <Button
                                data-testid={`button-registros-${index}`}
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleVerRegistros(resultado.numeroAsociado)
                                }
                                title="Ver Registros"
                              >
                                <Phone className="h-3 w-3" />
                              </Button>
                              <Button
                                data-testid={`button-coincidencias-${index}`}
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleCoincidencias(resultado.numeroAsociado)
                                }
                                title="Coincidencias"
                              >
                                <GitMerge className="h-3 w-3" />
                              </Button>
                              <Button
                                data-testid={`button-edit-${index}`}
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(resultado.id)}
                                title="Editar"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                data-testid={`button-delete-${index}`}
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleDelete(
                                    resultado.id,
                                    resultado.personaId,
                                    resultado.nombreCompleto
                                  )
                                }
                                title="Borrar"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal: Info Persona/Caso */}
      <Dialog open={showPersonaModal} onOpenChange={setShowPersonaModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información de Persona/Caso
            </DialogTitle>
          </DialogHeader>
          {loadingModal ? (
            <div className="py-8 text-center text-gray-500">Cargando...</div>
          ) : personaData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Expediente:
                  </label>
                  <p className="text-gray-900">{personaData.expediente}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Teléfono Principal:
                  </label>
                  <p className="text-gray-900 font-mono">
                    {personaData.telefono || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Cédula:
                  </label>
                  <p className="text-gray-900">{personaData.cedula}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Nombre:
                  </label>
                  <p className="text-gray-900">
                    {personaData.nombre} {personaData.apellido}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Seudónimo:
                  </label>
                  <p className="text-gray-900">
                    {personaData.pseudonimo || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Delito:
                  </label>
                  <p className="text-gray-900">{personaData.delito}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Fecha de Inicio:
                  </label>
                  <p className="text-gray-900">
                    {personaData.fechaDeInicio
                      ? new Date(personaData.fechaDeInicio).toLocaleDateString(
                          "es-ES"
                        )
                      : "N/A"}
                  </p>
                </div>
              </div>

              {personaData.telefonosAsociados &&
                personaData.telefonosAsociados.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      Números Telefónicos Asociados:
                    </label>
                    <div className="mt-2 space-y-1">
                      {personaData.telefonosAsociados.map(
                        (tel: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 p-2 rounded">
                            <p className="font-mono text-sm">{tel.numero}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Dirección:
                </label>
                <p className="text-gray-900">
                  {personaData.direccion || "N/A"}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Descripción:
                </label>
                <p className="text-gray-900 whitespace-pre-wrap">
                  {personaData.descripcion || "Sin descripción"}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No se pudo cargar la información
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Ver Registros de Comunicación */}
      <Dialog open={showRegistrosModal} onOpenChange={setShowRegistrosModal}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Registros de Comunicación Detallados
            </DialogTitle>
          </DialogHeader>
          {loadingModal ? (
            <div className="py-8 text-center text-gray-500">Cargando...</div>
          ) : (
            <div className="space-y-4">
              {/* Controles de filtrado y exportación */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg">
                {/* Filtro Global */}
                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    <Filter className="h-3 w-3 inline mr-1" />
                    Filtro Global
                  </label>
                  <Input
                    data-testid="input-filtro-global"
                    type="text"
                    placeholder="Buscar en todos los campos..."
                    value={filtroGlobal}
                    onChange={(e) => {
                      setFiltroGlobal(e.target.value);
                      setPaginaActual(1);
                    }}
                    className="text-sm"
                  />
                </div>

                {/* Filtro Fecha Inicio */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Fecha Inicio
                  </label>
                  <Input
                    data-testid="input-fecha-inicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => {
                      setFechaInicio(e.target.value);
                      setPaginaActual(1);
                    }}
                    className="text-sm"
                  />
                </div>

                {/* Filtro Fecha Fin */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Fecha Fin
                  </label>
                  <Input
                    data-testid="input-fecha-fin"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => {
                      setFechaFin(e.target.value);
                      setPaginaActual(1);
                    }}
                    className="text-sm"
                  />
                </div>

                {/* Filtro Tipo de Evento */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Tipo de Evento
                  </label>
                  <Select
                    value={tipoEvento}
                    onValueChange={(value) => {
                      setTipoEvento(value);
                      setPaginaActual(1);
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-tipo-evento"
                      className="text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="llamada">Llamadas</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="saliente">Salientes</SelectItem>
                      <SelectItem value="entrante">Entrantes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Registros por página */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Registros por página
                  </label>
                  <Select
                    value={String(registrosPorPagina)}
                    onValueChange={(value) => {
                      setRegistrosPorPagina(Number(value));
                      setPaginaActual(1);
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-registros-pagina"
                      className="text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="250">250</SelectItem>
                      <SelectItem value="600">600</SelectItem>
                      <SelectItem value="1200">1200</SelectItem>
                      <SelectItem value="999999">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Botón Exportar */}
                <div className="flex items-end">
                  <Button
                    data-testid="button-exportar-csv"
                    onClick={exportarRegistrosCSV}
                    variant="outline"
                    className="w-full text-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {/* Tabla de registros */}
              {(() => {
                const registrosFiltrados = getRegistrosFiltrados();
                const totalPaginas = Math.ceil(
                  registrosFiltrados.length / registrosPorPagina
                );
                const inicio = (paginaActual - 1) * registrosPorPagina;
                const fin = inicio + registrosPorPagina;
                const registrosPagina = registrosFiltrados.slice(inicio, fin);

                return registrosFiltrados.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">ABONADO A</TableHead>
                            <TableHead className="text-xs">ABONADO B</TableHead>
                            <TableHead className="text-xs">Tipo Transacción</TableHead>
                            <TableHead className="text-xs">Fecha</TableHead>
                            <TableHead className="text-xs">Hora</TableHead>
                            <TableHead className="text-xs">Time</TableHead>
                            <TableHead className="text-xs">BTS-Celda A</TableHead>
                            <TableHead className="text-xs">BTS-Celda B</TableHead>
                            <TableHead className="text-xs">Dirección A</TableHead>
                            <TableHead className="text-xs">Dirección B</TableHead>
                            <TableHead className="text-xs">Coordenadas A</TableHead>
                            <TableHead className="text-xs">Coordenadas B</TableHead>
                            <TableHead className="text-xs">Orientación A</TableHead>
                            <TableHead className="text-xs">Orientación B</TableHead>
                            <TableHead className="text-xs">IMEI A</TableHead>
                            <TableHead className="text-xs">IMEI B</TableHead>
                            <TableHead className="text-xs text-center">
                              Acciones
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registrosPagina.map((registro, idx) => (
                            <TableRow
                              key={idx}
                              data-testid={`row-registro-${idx}`}
                            >
                              <TableCell
                                className="font-mono text-xs"
                                data-testid={`text-abonado-a-${idx}`}
                              >
                                {registro.abonadoA || "N/A"}
                              </TableCell>
                              <TableCell
                                className="font-mono text-xs"
                                data-testid={`text-abonado-b-${idx}`}
                              >
                                {registro.abonadoB || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {registro.tipoTransaccion || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {registro.fecha || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {registro.hora || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {registro.time || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">
                                {registro.btsCeldaA || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">
                                {registro.btsCeldaB || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">
                                {registro.direccionA || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">
                                {registro.direccionB || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {registro.coordenadasA || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {registro.coordenadasB || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {registro.orientacionA || "N/A"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {registro.orientacionB || "N/A"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {registro.imeiA || "N/A"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {registro.imeiB || "N/A"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  data-testid={`button-trazar-contacto-${idx}`}
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleAnalizarContacto(registro.abonadoB)
                                  }
                                  disabled={!registro.abonadoB}
                                  title="Ver Traza de Contacto"
                                >
                                  <Repeat className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Paginación */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-600">
                        Mostrando {inicio + 1} a{" "}
                        {Math.min(fin, registrosFiltrados.length)} de{" "}
                        {registrosFiltrados.length} registros
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          data-testid="button-pagina-anterior"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPaginaActual((prev) => Math.max(1, prev - 1))
                          }
                          disabled={paginaActual === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          Página {paginaActual} de {totalPaginas || 1}
                        </span>
                        <Button
                          data-testid="button-pagina-siguiente"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPaginaActual((prev) =>
                              Math.min(totalPaginas, prev + 1)
                            )
                          }
                          disabled={paginaActual >= totalPaginas}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    No hay registros que coincidan con los filtros
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Coincidencias */}
      <Dialog
        open={showCoincidenciasModal}
        onOpenChange={setShowCoincidenciasModal}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <Activity className="h-5 w-5 text-amber-600" />
              Cruce de Trazabilidad: Coincidencias en Base de Datos
            </DialogTitle>
          </DialogHeader>

          {loadingModal ? (
            <div className="py-8 text-center text-gray-500">Cargando...</div>
          ) : coincidenciasData ? (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex flex-wrap gap-4 text-sm text-amber-900">
                <span><strong>Número analizado:</strong> {coincidenciasData.numeroAnalizado}</span>
                <span><strong>Total contactos únicos:</strong> {coincidenciasData.totalContactos}</span>
                <span><strong>Coincidencias registradas:</strong> {coincidenciasData.coincidenciasEncontradas}</span>
              </div>

              <p className="text-xs text-gray-500">
                Los siguientes números registran comunicaciones directas con el objetivo analizado y están plenamente identificados en el sistema.
              </p>

              {coincidenciasData.coincidencias && coincidenciasData.coincidencias.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-gray-700">Teléfono Interlocutor</TableHead>
                        <TableHead className="text-xs font-bold text-gray-700">Cédula / Identificación</TableHead>
                        <TableHead className="text-xs font-bold text-gray-700">Nombre Completo</TableHead>
                        <TableHead className="text-xs font-bold text-gray-700">Expedientes</TableHead>
                        <TableHead className="text-xs font-bold text-gray-700">Estatus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coincidenciasData.coincidencias.map((coincidencia: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-gray-50 align-top">
                          <TableCell className="font-mono text-xs font-bold text-blue-600 whitespace-nowrap">
                            📞 {coincidencia.numeroContactado}
                          </TableCell>
                          <TableCell className="text-xs">
                            {coincidencia.persona.cedula || "N/A"}
                          </TableCell>
                          <TableCell className="text-xs font-medium uppercase">
                            {coincidencia.persona.nombreCompleto || "Desconocido"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {coincidencia.persona.expedientes && coincidencia.persona.expedientes.length > 0 ? (
                              <div className="space-y-1">
                                {coincidencia.persona.expedientes.map((exp: any, ei: number) => (
                                  <div key={ei} className="bg-gray-50 rounded px-2 py-1 space-y-0.5">
                                    <p className="text-gray-700"><span className="font-medium">Exp:</span> {exp.expediente}</p>
                                    <p className="text-gray-600"><span className="font-medium">Delito:</span> {exp.delito}</p>
                                    {exp.fiscalia !== "—" && <p className="text-gray-500"><span className="font-medium">Fiscalía:</span> {exp.fiscalia}</p>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Sin expedientes</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Catalogado
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-500 border border-dashed rounded-lg">
                  No se hallaron números cruzados registrados en la base de datos para este número.
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No se pudo cargar las coincidencias
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Cargar Datos */}
      <CargarDatosModal
        open={showCargarDatosModal}
        onOpenChange={setShowCargarDatosModal}
        onSuccess={() => {
          toast({
            title: "Datos cargados",
            description: "Los datos se han cargado correctamente",
          });
        }}
      />

      {/* Modal: Editar Persona/Caso */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Persona/Caso
            </DialogTitle>
          </DialogHeader>
          {loadingModal ? (
            <div className="py-8 text-center text-gray-500">Cargando...</div>
          ) : editData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Cédula
                  </label>
                  <Input
                    value={editData.cedula || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, cedula: e.target.value })
                    }
                    placeholder="V-12345678"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Expediente
                  </label>
                  <Input
                    value={editData.expediente || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, expediente: e.target.value })
                    }
                    placeholder="EXP-2024-001"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Nombre *
                  </label>
                  <Input
                    value={editData.nombre || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, nombre: e.target.value })
                    }
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Apellido
                  </label>
                  <Input
                    value={editData.apellido || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, apellido: e.target.value })
                    }
                    placeholder="Apellido"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Teléfono
                  </label>
                  <Input
                    value={editData.telefono || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, telefono: e.target.value })
                    }
                    placeholder="0412XXXXXXX"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Seudónimo
                  </label>
                  <Input
                    value={editData.pseudonimo || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, pseudonimo: e.target.value })
                    }
                    placeholder="Seudónimo o alias"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Edad
                  </label>
                  <Input
                    type="number"
                    value={editData.edad || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, edad: e.target.value })
                    }
                    placeholder="Edad"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Fecha de Nacimiento
                  </label>
                  <Input
                    type="date"
                    value={editData.fechaDeNacimiento || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        fechaDeNacimiento: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Profesión
                  </label>
                  <Input
                    value={editData.profesion || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, profesion: e.target.value })
                    }
                    placeholder="Profesión u ocupación"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Fecha de Inicio
                  </label>
                  <Input
                    type="date"
                    value={editData.fechaDeInicio || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        fechaDeInicio: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Delito
                  </label>
                  <Input
                    value={editData.delito || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, delito: e.target.value })
                    }
                    placeholder="Delito imputado"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    N° de Oficio
                  </label>
                  <Input
                    value={editData.nOficio || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, nOficio: e.target.value })
                    }
                    placeholder="Número de oficio"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Fiscalía
                  </label>
                  <Input
                    value={editData.fiscalia || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, fiscalia: e.target.value })
                    }
                    placeholder="Fiscalía asignada"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Dirección
                  </label>
                  <Input
                    value={editData.direccion || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, direccion: e.target.value })
                    }
                    placeholder="Dirección de residencia"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Descripción
                  </label>
                  <Textarea
                    value={editData.descripcion || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, descripcion: e.target.value })
                    }
                    placeholder="Descripción detallada del caso"
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Observación
                  </label>
                  <Textarea
                    value={editData.observacion || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, observacion: e.target.value })
                    }
                    placeholder="Observaciones adicionales"
                    rows={3}
                  />
                </div>
              </div>

              {/* Sección de Registros Comunicacionales */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Registros Comunicacionales
                </h3>

                {/* Registro actual */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">
                        Registro Comunicacional Actual
                      </label>
                      <p className="text-sm text-gray-600">
                        ({editRegistros.length} comunicaciones)
                      </p>
                    </div>
                    {editRegistros.length > 0 && (
                      <Button
                        onClick={handleDeleteAllRegistros}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Borrar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Subir nuevo archivo de registros */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Agregar Nuevo Registro
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt"
                      onChange={(e) =>
                        setArchivoNuevoRegistro(e.target.files?.[0] || null)
                      }
                      className="flex-1"
                    />
                    <Button
                      onClick={handleUploadRegistros}
                      disabled={!archivoNuevoRegistro || isUploadingRegistro}
                      variant="outline"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingRegistro ? "Importando..." : "Importar"}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Formatos permitidos: Excel (.xlsx, .xls), CSV (.csv) o TXT
                    (.txt)
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No se pudo cargar la información
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Análisis de Traza */}
      <Dialog open={showAnalisisModal} onOpenChange={setShowAnalisisModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Análisis de Traza — {analisisData?.numeroAnalizado}
            </DialogTitle>
          </DialogHeader>

          {loadingModal ? (
            <div className="py-12 text-center text-gray-500">Analizando...</div>
          ) : analisisData ? (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Número Analizado</p>
                  <p className="text-sm font-semibold text-blue-900">{analisisData.numeroAnalizado}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Total Comunicaciones</p>
                  <p className="text-sm font-semibold text-blue-900">{analisisData.totalComunicaciones}</p>
                </div>
              </div>

              {/* Sección 1: Contactos Frecuentes */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-1">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-700">Contactos Frecuentes</h3>
                  <span className="ml-auto text-xs text-gray-400">{contactosFrecuentes.length} contactos</span>
                </div>
                {contactosFrecuentes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4 border rounded-lg">Sin contactos registrados</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border rounded-lg border-blue-200">
                    <Table>
                      <TableHeader className="bg-blue-50">
                        <TableRow>
                          <TableHead className="w-8 py-1 px-2 text-xs">#</TableHead>
                          <TableHead className="py-1 px-2 text-xs">INTERLOCUTOR</TableHead>
                          {tiposColumnas.map(t => (
                            <TableHead key={t} className="py-1 px-2 text-center text-[10px] leading-tight font-bold text-blue-900">{t}</TableHead>
                          ))}
                          <TableHead className="py-1 px-2 text-center text-xs font-bold">TOTAL</TableHead>
                          <TableHead className="py-1 px-2 text-xs">PRIMERA FECHA</TableHead>
                          <TableHead className="py-1 px-2 text-xs">ÚLTIMA FECHA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contactosFrecuentes.map((c, i) => (
                          <TableRow key={c.numero + i}>
                            <TableCell className="py-1 px-2 text-xs font-bold">{i + 1}</TableCell>
                            <TableCell className="py-1 px-2 text-xs font-mono font-bold">{c.numero || "-"}</TableCell>
                            {tiposColumnas.map(t => (
                              <TableCell key={t} className="py-1 px-2 text-xs text-center border-l border-gray-100">
                                {c[t] > 0 ? <span className="font-medium text-gray-700">{c[t]}</span> : ""}
                              </TableCell>
                            ))}
                            <TableCell className="py-1 px-2 text-xs text-center font-bold bg-blue-50/30">{c.frecuencia || 0}</TableCell>
                            <TableCell className="py-1 px-2 text-xs text-gray-500">{c.primera_fecha || "-"}</TableCell>
                            <TableCell className="py-1 px-2 text-xs text-gray-500">{c.ultima_fecha || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Sección 2: IMEI */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-1">
                  <Info className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-700">IMEI</h3>
                  <span className="ml-auto text-xs text-gray-400">{imeis.length} dispositivos</span>
                </div>
                {imeis.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4 border rounded-lg">Sin datos de IMEI</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="py-1 px-2 text-xs w-8">#</TableHead>
                          <TableHead className="py-1 px-2 text-xs">NÚMERO ESTUDIADO</TableHead>
                          <TableHead className="py-1 px-2 text-xs">IMEI</TableHead>
                          <TableHead className="py-1 px-2 text-xs text-center">CANTIDAD DE USOS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {imeis.map((item, i) => (
                          <TableRow key={item.imei}>
                            <TableCell className="py-1 px-2 text-xs text-gray-400">{i + 1}</TableCell>
                            <TableCell className="py-1 px-2 text-xs">{analisisData?.numeroAnalizado}</TableCell>
                            <TableCell className="py-1 px-2 text-xs font-mono">{item.imei}</TableCell>
                            <TableCell className="py-1 px-2 text-xs text-center font-bold">{item.cantidad}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Sección 3: Georreferenciación — filas planas como Excel de experticia */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-1">
                  <Search className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-700">Georreferenciación</h3>
                  <span className="ml-auto text-xs text-gray-400">{georref.length} registros BTS</span>
                </div>
                {georref.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4 border rounded-lg">Sin datos de georreferenciación</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="py-1 px-2 text-xs text-center">Frec. Total Física</TableHead>
                          <TableHead className="py-1 px-2 text-xs text-center">Frec. por Celda</TableHead>
                          <TableHead className="py-1 px-2 text-xs">BTS-Celda</TableHead>
                          <TableHead className="py-1 px-2 text-xs">Dirección</TableHead>
                          <TableHead className="py-1 px-2 text-xs">Coordenadas (Lat, Lon)</TableHead>
                          <TableHead className="py-1 px-2 text-xs">Orientación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {georref.map((g, i) => (
                          <TableRow key={i} className={g.frecTotalFisica !== "" ? "border-t-2 border-gray-300" : ""}>
                            <TableCell className="py-1 px-2 text-xs text-center font-bold">
                              {g.frecTotalFisica !== "" ? g.frecTotalFisica : ""}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-xs text-center">{g.frecPorCelda}</TableCell>
                            <TableCell className="py-1 px-2 text-xs font-mono">{g.btsCelda}</TableCell>
                            <TableCell className="py-1 px-2 text-xs">{g.direccion}</TableCell>
                            <TableCell className="py-1 px-2 text-xs font-mono">{g.coordenadas}</TableCell>
                            <TableCell className="py-1 px-2 text-xs">{g.orientacion}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No se pudo cargar el análisis
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
