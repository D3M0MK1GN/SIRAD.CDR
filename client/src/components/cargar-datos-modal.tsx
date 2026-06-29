import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Upload,
  FileSpreadsheet,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

interface CargarDatosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Esquema de validación para el formulario de Persona/Caso
const personaCasoSchema = z.object({
  telefono: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === "") return true;
      const numeros = val.replace(/\D/g, "");
      return numeros.length === 10;
    }, "El teléfono debe tener exactamente 10 dígitos"),
  cedula: z.string().optional(),
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().optional(),
  pseudonimo: z.string().optional(),
  edad: z.string().optional(),
  fechaDeNacimiento: z.string().optional(),
  profesion: z.string().optional(),
  direccion: z.string().optional(),
  expediente: z.string().optional(),
  fechaDeInicio: z.string().optional(),
  delito: z.string().optional(),
  nOficio: z.string().optional(),
  fiscalia: z.string().optional(),
  descripcion: z.string().optional(),
  observacion: z.string().optional(),
});

type PersonaCasoFormData = z.infer<typeof personaCasoSchema>;

export function CargarDatosModal({
  open,
  onOpenChange,
  onSuccess,
}: CargarDatosModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [opcionSeleccionada, setOpcionSeleccionada] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);

  const form = useForm<PersonaCasoFormData>({
    resolver: zodResolver(personaCasoSchema),
    defaultValues: {
      telefono: "",
      cedula: "",
      nombre: "",
      apellido: "",
      pseudonimo: "",
      edad: "",
      fechaDeNacimiento: "",
      profesion: "",
      direccion: "",
      expediente: "",
      fechaDeInicio: "",
      delito: "",
      nOficio: "",
      fiscalia: "",
      descripcion: "",
      observacion: "",
    },
  });

  const handleReset = () => {
    setOpcionSeleccionada(null);
    setArchivo(null);
    form.reset();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv", "txt"].includes(extension || "")) {
        toast({
          title: "Formato no válido",
          description:
            "Solo se permiten archivos Excel (.xlsx, .xls), CSV (.csv) o TXT (.txt)",
          variant: "destructive",
        });
        return;
      }
      setArchivo(file);
    }
  };

  const handleGuardarCasoCompleto = async (data: PersonaCasoFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/personas-casos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          ...data,
          edad: data.edad ? parseInt(data.edad) : null,
        }),
      });

      if (response.ok) {
        if (archivo && data.telefono) {
          const formDataToSend = new FormData();
          formDataToSend.append("archivo", archivo);
          formDataToSend.append("numeroAsociado", data.telefono);

          const registrosResponse = await fetch(
            "/api/registros-comunicacion/importar",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
              body: formDataToSend,
            }
          );

          if (registrosResponse.ok) {
            const registrosData = await registrosResponse.json();
            toast({
              title: "Éxito",
              description: `Caso creado con ${registrosData.registrosImportados} registros importados`,
            });
          } else {
            toast({
              title: "Parcialmente exitoso",
              description:
                "Caso creado, pero hubo un error al importar los registros",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Éxito",
            description: "Persona/Caso creado correctamente",
          });
        }

        handleReset();
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "No se pudo crear la persona/caso",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al crear persona/caso:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al crear la persona/caso",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportarRegistros = async () => {
    if (!archivo) {
      toast({
        title: "Archivo requerido",
        description: "Por favor selecciona un archivo para importar",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const formDataToSend = new FormData();
    formDataToSend.append("archivo", archivo);

    const telefono = form.getValues("telefono");
    if (opcionSeleccionada === 1 && telefono) {
      formDataToSend.append("numeroAsociado", telefono);
    }

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
        handleReset();
        onOpenChange(false);
        onSuccess?.();
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
      setIsLoading(false);
    }
  };

  const renderSeleccionOpcion = () => (
    <div className="space-y-4 py-4" data-testid="seleccion-opciones">
      <p className="text-sm text-gray-600 mb-6">
        Selecciona el tipo de carga que deseas realizar:
      </p>

      <Card
        className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
        onClick={() => setOpcionSeleccionada(1)}
        data-testid="opcion-caso-completo"
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">
                Opción 1: Cargar Caso Completo
              </h3>
              <p className="text-sm text-gray-600">
                Crea una nueva persona/caso y opcionalmente importa sus
                registros de comunicación
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
        onClick={() => setOpcionSeleccionada(2)}
        data-testid="opcion-solo-registros"
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">
                Opción 2: Cargar Solo Registros
              </h3>
              <p className="text-sm text-gray-600">
                Importa únicamente registros de comunicación sin crear una
                persona/caso
              </p>
              <div className="mt-3 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Importación directa de archivo (Excel/CSV/TXT)
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFormularioPersona = () => (
    <Form {...form}>
      <form className="space-y-4 py-4" data-testid="formulario-persona-caso">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cedula"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cédula</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="V-12345678"
                    data-testid="input-cedula"
                    onChange={(e) => {
                      let value = e.target.value.toUpperCase();
                      if (value.startsWith("V-") || value.startsWith("E-")) {
                        field.onChange(value);
                      } else if (value.match(/^\d/)) {
                        field.onChange("V-" + value.replace(/[^0-9]/g, ""));
                      } else if (value.length > 0) {
                        field.onChange(value);
                      } else {
                        field.onChange("");
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
            name="expediente"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expediente</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="EXP-2024-001"
                    data-testid="input-expediente"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-nombre" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apellido"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-apellido" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono Principal</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="4121234567"
                    data-testid="input-telefono"
                    maxLength={10}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, "");
                      if (value.startsWith("0")) {
                        value = value.substring(1);
                      }
                      field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pseudonimo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seudónimo</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-pseudonimo" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="edad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Edad</FormLabel>
                <FormControl>
                  <Input {...field} type="number" data-testid="input-edad" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fechaDeNacimiento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Nacimiento</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="date"
                    data-testid="input-fecha-nacimiento"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profesion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profesión</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-profesion" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fechaDeInicio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Inicio</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="date"
                    data-testid="input-fecha-inicio"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="delito"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delito</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-delito" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nOficio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>N° Oficio</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    data-testid="input-n-oficio"
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9-]/g, "");
                      field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="fiscalia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fiscalía</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-fiscalia" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="direccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-direccion" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      data-testid="textarea-descripcion"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="observacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observación</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      data-testid="textarea-observacion"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </form>
    </Form>
  );

  const renderImportarArchivo = () => (
    <div className="space-y-4 py-4" data-testid="seccion-importar-archivo">
      <div
        className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"
        data-testid="info-formato-archivo"
      >
        <h4 className="font-semibold text-sm text-blue-900 mb-2">
          Formato del archivo
        </h4>
        <p className="text-xs text-blue-800 mb-2">
          El archivo debe contener las siguientes columnas:
        </p>
        <div className="text-xs text-blue-700 space-y-1">
          <div>• ABONADO A</div>
          <div>• IMSI ABONADO A</div>
          <div>• IMEI ABONADO A</div>
          <div>• ABONADO B</div>
          <div>• IMSI ABONADO B</div>
          <div>• IMEI ABONADO B</div>
          <div>• TIPO DE TRANSACCION</div>
          <div>• FECHA</div>
          <div>• HORA</div>
          <div>• SEG</div>
          <div>• Atena</div>
          <div>• LATITUD CELDAD INICIO A</div>
          <div>• LONGITUD CELDA INICIO A</div>
        </div>
        <p className="text-xs text-blue-800 mt-2">
          Formatos permitidos: Excel (.xlsx, .xls), CSV (.csv), TXT (.txt)
        </p>
      </div>

      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
        data-testid="zona-carga-archivo"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          onChange={handleFileChange}
          className="hidden"
          data-testid="file-input"
        />

        {archivo ? (
          <div className="space-y-4" data-testid="archivo-seleccionado">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-green-600" />
            <div>
              <p
                className="font-medium text-gray-900"
                data-testid="nombre-archivo"
              >
                {archivo.name}
              </p>
              <p className="text-sm text-gray-500" data-testid="tamano-archivo">
                {(archivo.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-cambiar-archivo"
            >
              Cambiar archivo
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="sin-archivo">
            <Upload className="h-12 w-12 mx-auto text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">
                Arrastra un archivo o haz clic para seleccionar
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Excel, CSV o TXT (máx. 50MB)
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-seleccionar-archivo"
            >
              Seleccionar archivo
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderFormularioCasoCompleto = () => (
    <>
      <div className="mb-4">
        <h3 className="font-semibold text-lg">Cargar Caso Completo</h3>
        <p className="text-sm text-gray-600">
          Completa los datos de la persona/caso y opcionalmente agrega registros
        </p>
      </div>
      <Form {...form}>
        <form className="space-y-4 py-4" data-testid="formulario-persona-caso">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cedula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cédula</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="V-12345678"
                      data-testid="input-cedula"
                      onChange={(e) => {
                        let value = e.target.value.toUpperCase();
                        if (value.startsWith("V-") || value.startsWith("E-")) {
                          field.onChange(value);
                        } else if (value.match(/^\d/)) {
                          field.onChange("V-" + value.replace(/[^0-9]/g, ""));
                        } else if (value.length > 0) {
                          field.onChange(value);
                        } else {
                          field.onChange("");
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
              name="expediente"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expediente</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="EXP-2024-001"
                      data-testid="input-expediente"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-nombre" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apellido"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apellido</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-apellido" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telefono"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono Principal</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="4121234567"
                      data-testid="input-telefono"
                      maxLength={10}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, "");
                        if (value.startsWith("0")) {
                          value = value.substring(1);
                        }
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pseudonimo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seudónimo</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-pseudonimo" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="edad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Edad</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" data-testid="input-edad" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fechaDeNacimiento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Nacimiento</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      data-testid="input-fecha-nacimiento"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="profesion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profesión</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-profesion" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fechaDeInicio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Inicio</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      data-testid="input-fecha-inicio"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="delito"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delito</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-delito" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nOficio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>N° Oficio</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-n-oficio"
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9-]/g, "");
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-2">
              <FormField
                control={form.control}
                name="fiscalia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiscalía</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-fiscalia" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="col-span-2">
              <FormField
                control={form.control}
                name="direccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-direccion" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="col-span-2">
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        data-testid="textarea-descripcion"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="col-span-2">
              <FormField
                control={form.control}
                name="observacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observación</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        data-testid="textarea-observacion"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Sección de Registros Comunicacionales */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-md font-semibold mb-3">
              Agregar Nuevo Registro (Opcional)
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Archivo de Registros Comunicacionales
              </label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {archivo && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ Archivo seleccionado: {archivo.name}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Formatos permitidos: Excel (.xlsx, .xls), CSV (.csv) o TXT
                (.txt)
              </p>
            </div>
          </div>
        </form>
      </Form>
    </>
  );

  const renderContenido = () => {
    if (!opcionSeleccionada) {
      return renderSeleccionOpcion();
    }

    if (opcionSeleccionada === 1) {
      return renderFormularioCasoCompleto();
    }

    if (opcionSeleccionada === 2) {
      return (
        <>
          <div className="mb-4">
            <h3 className="font-semibold text-lg">
              Importar Registros de Comunicación
            </h3>
            <p className="text-sm text-gray-600">
              Sube el archivo con los registros de comunicación
            </p>
          </div>
          {renderImportarArchivo()}
        </>
      );
    }
  };

  const renderBotones = () => {
    if (!opcionSeleccionada) {
      return (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar"
          >
            Cancelar
          </Button>
        </div>
      );
    }

    if (opcionSeleccionada === 1) {
      return (
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setOpcionSeleccionada(null)}
            disabled={isLoading}
            data-testid="button-atras-opcion"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={form.handleSubmit(handleGuardarCasoCompleto)}
            disabled={isLoading}
            data-testid="button-guardar"
          >
            {isLoading ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      );
    }

    if (opcionSeleccionada === 2) {
      return (
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setOpcionSeleccionada(null)}
            disabled={isLoading}
            data-testid="button-atras-opcion-2"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={handleImportarRegistros}
            disabled={isLoading || !archivo}
            data-testid="button-importar"
          >
            {isLoading ? "Importando..." : "Importar"}
          </Button>
        </div>
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleReset();
        }
        onOpenChange(isOpen);
      }}
    >
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="modal-cargar-datos"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Cargar Datos
          </DialogTitle>
        </DialogHeader>

        {renderContenido()}

        <div className="mt-6">{renderBotones()}</div>
      </DialogContent>
    </Dialog>
  );
}
