#!/usr/bin/env python3
"""
API RESTful con FastAPI para integrar servicios Python con el sistema TER
Conecta el sistema de consulta de cédulas (infoI.py) con el chatbot del sistema principal
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import requests
import json
import os
import sys
from datetime import datetime
import uvicorn

# Agregar el directorio osintpython al path para importar infoI
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'osintpython'))

# Agregar el directorio experticias al path para importar BTSIdentifier
sys.path.append(os.path.join(os.path.dirname(__file__), 'experticias'))

# Importar funciones de infoI.py
try:
    from infoI import cargar_logs, guardar_logs, APP_ID, TOKEN, BASE_URL, LOG_FILE
except ImportError as e:
    print(f"Error importando infoI.py: {e}")
    # Valores por defecto si no se puede importar
    APP_ID = "1966"
    TOKEN = "f82f78de1c215aae3d0c30a4e020b561"
    BASE_URL = "http://api.cedula.com.ve/api/v1"
    LOG_FILE = "consultas_cedulas.json"

# Importar Exper_Frecuentes
try:
    from identify_bts import Exper_Frecuentes
except ImportError as e:
    print(f"Error importando Exper_Frecuentes: {e}")
    Exper_Frecuentes = None

# Crear la aplicación FastAPI
app = FastAPI(
    title="TER-System OSINT API",
    description="API RESTful para servicios de inteligencia y consultas de cédulas venezolanas",
    version="1.0.0"
)

# Configurar CORS para permitir conexiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://127.0.0.1:5000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos Pydantic para validación de datos
class ConsultaCedulaRequest(BaseModel):
    nacionalidad: str
    cedula: str

class ConsultaCedulaResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str

class HistorialResponse(BaseModel):
    consultas: List[Dict[str, Any]]
    total: int

class AnalizarBTSRequest(BaseModel):
    archivo_excel: str
    numero_buscar: str
    operador: str

class AnalizarBTSResponse(BaseModel):
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    timestamp: str

class AnalizarContactosFrecuentesRequest(BaseModel):
    archivo_excel: str
    numero_buscar: str
    operador: str

class AnalizarContactosFrecuentesResponse(BaseModel):
    success: bool
    datos_crudos: Optional[List[Dict[str, Any]]] = None
    top_10_contactos: Optional[List[Dict[str, Any]]] = None
    datos_filiatorios: Optional[Dict[str, Any]] = None
    imeis_utilizados: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    timestamp: str

# Funciones auxiliares
def cargar_logs():
    """Carga las consultas existentes desde el archivo JSON."""
    log_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'osintpython', LOG_FILE)
    if os.path.exists(log_path):
        with open(log_path, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def guardar_logs(logs):
    """Guarda las consultas en el archivo JSON."""
    log_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'osintpython', LOG_FILE)
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump(logs, f, indent=4, ensure_ascii=False)

# Endpoints de la API
@app.get("/")
async def root():
    """Endpoint raíz con información de la API"""
    return {
        "message": "TER-System OSINT API",
        "version": "1.0.0",
        "description": "API para servicios de inteligencia y consultas de cédulas",
        "endpoints": [
            "/consulta-cedula",
            "/historial-consultas",
            "/analizar-bts",
            "/health"
        ]
    }

@app.get("/health")
async def health_check():
    """Endpoint de salud para verificar que la API está funcionando"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "TER-System OSINT API"
    }

@app.post("/consulta-cedula", response_model=ConsultaCedulaResponse)
async def consultar_cedula(request: ConsultaCedulaRequest):
    """
    Consulta información de una cédula venezolana
    """
    print(f"[LOG] Iniciando consulta de cédula: nacionalidad={request.nacionalidad}, cedula={request.cedula}")
    try:
        # Validar nacionalidad
        print(f"[LOG] Validando nacionalidad: {request.nacionalidad}")
        if request.nacionalidad.upper() not in ['V', 'E']:
            print(f"[ERROR] Nacionalidad inválida: {request.nacionalidad}")
            raise HTTPException(
                status_code=400, 
                detail="Nacionalidad inválida. Use 'V' para Venezolano o 'E' para Extranjero"
            )
        
        # Validar cédula
        print(f"[LOG] Validando cédula: {request.cedula}")
        if not request.cedula.isdigit():
            print(f"[ERROR] Cédula inválida: {request.cedula}")
            raise HTTPException(
                status_code=400, 
                detail="Número de cédula inválido. Solo se permiten dígitos"
            )
        
        nacionalidad = request.nacionalidad.upper()
        cedula = request.cedula.strip()
        
        # Construir URL de la consulta
        url = f"{BASE_URL}?app_id={APP_ID}&token={TOKEN}&nacionalidad={nacionalidad}&cedula={cedula}"
        print(f"[LOG] URL de consulta construida: {url}")
        
        # Realizar la petición HTTP
        print(f"[LOG] Realizando petición HTTP a la API externa")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        print(f"[LOG] Respuesta recibida de la API externa: {data}")
        
        # Preparar registro para el log
        consulta_registro = {
            "timestamp": datetime.now().isoformat(),
            "nacionalidad_consultada": nacionalidad,
            "cedula_consultada": cedula,
            "url_completa": url,
            "resultado_api": data,
            "success": True
        }
        
        # Guardar en el historial
        print(f"[LOG] Guardando consulta en el historial")
        logs = cargar_logs()
        logs.append(consulta_registro)
        guardar_logs(logs)
        
        print(f"[LOG] Consulta de cédula finalizada correctamente")
        return ConsultaCedulaResponse(
            success=True,
            data=data,
            timestamp=datetime.now().isoformat()
        )
        
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Error de conexión con la API externa: {str(e)}")
        # Error de conexión con la API externa
        error_registro = {
            "timestamp": datetime.now().isoformat(),
            "nacionalidad_consultada": request.nacionalidad.upper(),
            "cedula_consultada": request.cedula,
            "url_completa": f"{BASE_URL}?app_id={APP_ID}&token={TOKEN}&nacionalidad={request.nacionalidad.upper()}&cedula={request.cedula}",
            "error": str(e),
            "success": False
        }
        
        logs = cargar_logs()
        logs.append(error_registro)
        guardar_logs(logs)
        
        return ConsultaCedulaResponse(
            success=False,
            error=f"Error al conectar con la API: {str(e)}",
            timestamp=datetime.now().isoformat()
        )
    
    except json.JSONDecodeError:
        print(f"[ERROR] La respuesta de la API no es un JSON válido")
        return ConsultaCedulaResponse(
            success=False,
            error="Error: La respuesta de la API no es un JSON válido",
            timestamp=datetime.now().isoformat()
        )
    
    except Exception as e:
        print(f"[ERROR] Error interno en consulta de cédula: {str(e)}")
        return ConsultaCedulaResponse(
            success=False,
            error=f"Error interno: {str(e)}",
            timestamp=datetime.now().isoformat()
        )

@app.post("/analizar-bts", response_model=AnalizarBTSResponse)
async def analizar_bts(request: AnalizarBTSRequest):
    """
    Analiza archivo Excel BTS buscando número de abonado
    """
    print(f"[LOG] Iniciando análisis BTS: archivo={request.archivo_excel}, numero={request.numero_buscar}, operador={request.operador}")
    try:
        if Exper_Frecuentes is None:
            print(f"[ERROR] Servicio de análisis BTS no disponible")
            raise HTTPException(
                status_code=500, 
                detail="Servicio de análisis BTS no disponible"
            )
        
        # Validar que el archivo existe
        print(f"[LOG] Verificando existencia del archivo: {request.archivo_excel}")
        if not os.path.exists(request.archivo_excel):
            print(f"[ERROR] Archivo Excel no encontrado: {request.archivo_excel}")
            raise HTTPException(
                status_code=400, 
                detail="Archivo Excel no encontrado"
            )
        print(f"[LOG] Archivo encontrado correctamente")
        
        # Crear instancia de Exper_Frecuentes
        print(f"[LOG] Creando instancia de Exper_Frecuentes")
        analizador = Exper_Frecuentes()
        
        # Realizar análisis
        print(f"[LOG] Llamando buscar_por_abonado_b con parámetros: archivo={request.archivo_excel}, numero={request.numero_buscar}, operador={request.operador}")
        resultados = analizador.buscar_por_abonado_b(
            request.archivo_excel, 
            request.numero_buscar,
            request.operador
        )
        print(f"Operadora a consultar: {request.operador}")
        
        if resultados is None or resultados.empty:
            print(f"[LOG] No se encontraron resultados en el análisis BTS")
            return AnalizarBTSResponse(
                success=True,
                data=[],
                timestamp=datetime.now().isoformat()
            )
        
        # Convertir DataFrame a lista de diccionarios
        print(f"[LOG] Convirtiendo resultados a lista de diccionarios")
        resultados_list = resultados.to_dict('records')
        
        print(f"[LOG] Análisis BTS finalizado correctamente")
        return AnalizarBTSResponse(
            success=True,
            data=resultados_list,
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        print(f"[ERROR] HTTPException lanzada en análisis BTS")
        raise
    except Exception as e:
        print(f"[ERROR] Excepción en análisis BTS: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return AnalizarBTSResponse(
            success=False,
            error=f"Error al analizar archivo BTS: {str(e)}",
            timestamp=datetime.now().isoformat()
        )

@app.post("/analizar-contactos-frecuentes", response_model=AnalizarContactosFrecuentesResponse)
async def analizar_contactos_frecuentes(request: AnalizarContactosFrecuentesRequest):
    """
    Analiza archivo Excel para determinar contactos frecuentes.
    Retorna dos conjuntos de datos:
    1. datos_crudos: Primeras 6 columnas del Excel (ABONADO A, ABONADO B, FECHA, HORA, TIME, DIRECCION)
    2. top_10_contactos: TOP 10 números con mayor frecuencia de comunicación
    
    Toda la lógica de procesamiento centralizada en Exper_Frecuentes.buscar_numeros_frecuentan()
    """
    print(f"[LOG] Iniciando análisis Contactos Frecuentes: archivo={request.archivo_excel}, numero={request.numero_buscar}, operador={request.operador}")
    try:
        # Validación básica
        if Exper_Frecuentes is None:
            raise HTTPException(status_code=500, detail="Servicio de análisis no disponible")
        
        if not os.path.exists(request.archivo_excel):
            raise HTTPException(status_code=404, detail="Archivo Excel no encontrado")
        
        # Llamar al analizador (Toda la lógica de Excel está ahora aquí)
        analizador = Exper_Frecuentes()
        resultado = analizador.buscar_numeros_frecuentan(
            request.archivo_excel,
            request.numero_buscar,
            request.operador
        )

        # Extraer datos filiatorios según el operador
        datos_filiatorios = None
        if 'movistar' in request.operador.lower():
            datos_filiatorios = analizador.extraer_datos_filiatorios_movistar(request.archivo_excel)
            if not datos_filiatorios:
                datos_filiatorios = None
        elif 'digitel' in request.operador.lower():
            datos_filiatorios = analizador.extraer_datos_filiatorios_digitel(request.archivo_excel)
            if not datos_filiatorios:
                datos_filiatorios = None

        if not resultado:
            return AnalizarContactosFrecuentesResponse(
                success=True,
                datos_crudos=[],
                top_10_contactos=[],
                imeis_utilizados=[],
                datos_filiatorios=datos_filiatorios,
                timestamp=datetime.now().isoformat()
            )
        
        print(f"[LOG] Análisis completado: {len(resultado.get('datos_crudos', []))} filas crudas, {len(resultado.get('top_10', []))} contactos frecuentes, {len(resultado.get('imeis_utilizados', []))} IMEIs")
        return AnalizarContactosFrecuentesResponse(
            success=True,
            datos_crudos=resultado.get('datos_crudos', []),
            top_10_contactos=resultado.get('top_10', []),
            imeis_utilizados=resultado.get('imeis_utilizados', []),
            datos_filiatorios=datos_filiatorios,
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Excepción en análisis Contactos Frecuentes: {str(e)}")
        return AnalizarContactosFrecuentesResponse(
            success=False,
            error=f"Error al analizar contactos frecuentes: {str(e)}",
            timestamp=datetime.now().isoformat()
        )

@app.get("/historial-consultas", response_model=HistorialResponse)
async def obtener_historial(limit: int = 50, offset: int = 0):
    """
    Obtiene el historial de consultas realizadas
    """
    print(f"[LOG] Obteniendo historial de consultas: limit={limit}, offset={offset}")
    try:
        logs = cargar_logs()
        print(f"[LOG] Total de consultas en historial: {len(logs)}")
        
        # Ordenar por timestamp descendente (más recientes primero)
        logs_ordenados = sorted(logs, key=lambda x: x.get('timestamp', ''), reverse=True)
        print(f"[LOG] Historial ordenado por fecha")
        
        # Aplicar paginación
        consultas_paginadas = logs_ordenados[offset:offset + limit]
        print(f"[LOG] Historial paginado: {len(consultas_paginadas)} registros devueltos")
        
        return HistorialResponse(
            consultas=consultas_paginadas,
            total=len(logs)
        )
        
    except Exception as e:
        print(f"[ERROR] Error al obtener historial: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener historial: {str(e)}")

@app.delete("/historial-consultas")
async def limpiar_historial():
    """
    Limpia el historial de consultas
    """
    print(f"[LOG] Limpiando historial de consultas")
    try:
        guardar_logs([])
        print(f"[LOG] Historial limpiado exitosamente")
        return {"message": "Historial limpiado exitosamente", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        print(f"[ERROR] Error al limpiar historial: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al limpiar historial: {str(e)}")

@app.get("/stats")
async def obtener_estadisticas():
    """
    Obtiene estadísticas de uso de la API
    """
    print(f"[LOG] Obteniendo estadísticas de uso de la API")
    try:
        logs = cargar_logs()
        print(f"[LOG] Total de consultas en logs: {len(logs)}")
        
        total_consultas = len(logs)
        consultas_exitosas = len([log for log in logs if log.get('success', False)])
        consultas_fallidas = total_consultas - consultas_exitosas
        
        # Estadísticas por nacionalidad
        venezolanos = len([log for log in logs if log.get('nacionalidad_consultada') == 'V'])
        extranjeros = len([log for log in logs if log.get('nacionalidad_consultada') == 'E'])
        
        print(f"[LOG] Estadísticas calculadas: exitosas={consultas_exitosas}, fallidas={consultas_fallidas}, venezolanos={venezolanos}, extranjeros={extranjeros}")
        return {
            "total_consultas": total_consultas,
            "consultas_exitosas": consultas_exitosas,
            "consultas_fallidas": consultas_fallidas,
            "tasa_exito": round((consultas_exitosas / total_consultas * 100), 2) if total_consultas > 0 else 0,
            "consultas_venezolanos": venezolanos,
            "consultas_extranjeros": extranjeros,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"[ERROR] Error al obtener estadísticas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas: {str(e)}")

class RegistroItem(BaseModel):
    abonadoA: Optional[str] = None
    abonadoB: Optional[str] = None
    tipoTransaccion: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    imeiA: Optional[str] = None
    imeiB: Optional[str] = None
    btsCeldaA: Optional[str] = None
    btsCeldaB: Optional[str] = None
    direccionA: Optional[str] = None
    direccionB: Optional[str] = None
    coordenadasA: Optional[str] = None
    coordenadasB: Optional[str] = None
    orientacionA: Optional[str] = None
    orientacionB: Optional[str] = None

class AnalizarRegistrosDBRequest(BaseModel):
    numero: str
    registros: List[RegistroItem]

@app.post("/analizar-registros-db")
async def analizar_registros_db(request: AnalizarRegistrosDBRequest):
    """
    Recibe registros de comunicación desde la BD y devuelve:
    - contactosFrecuentes: ordenados desc por frecuencia
    - imeis: lista de IMEI únicos
    - georref: celdas BTS únicas con dirección y coordenadas
    """
    try:
        import pandas as pd
        import numpy as np

        numero = str(request.numero).strip()
        registros = [r.dict() for r in request.registros]

        if not registros:
            return {
                "contactosFrecuentes": [],
                "imeis": [],
                "georref": [],
                "totalComunicaciones": 0
            }

        datos = pd.DataFrame(registros)

        def normalizar(n):
            s = str(n).strip() if n else ""
            if s.endswith(".0"):
                s = s[:-2]
            if s.startswith("58") and len(s) == 12 and s.isdigit():
                s = s[2:]
            if s.startswith("0") and len(s) > 1:
                s = s[1:]
            return s

        numero_norm = normalizar(numero)
        datos["_A_NORM"] = datos["abonadoA"].apply(normalizar)
        datos["_B_NORM"] = datos["abonadoB"].apply(normalizar)

        mask = (datos["_A_NORM"] == numero_norm) | (datos["_B_NORM"] == numero_norm)
        datos_interes = datos[mask].copy()

        if datos_interes.empty:
            return {
                "contactosFrecuentes": [],
                "imeis": [],
                "georref": [],
                "totalComunicaciones": 0
            }

        # Identificar el "otro" número en cada comunicación
        datos_interes["CONTACTO"] = np.where(
            datos_interes["_A_NORM"] == numero_norm,
            datos_interes["_B_NORM"],
            datos_interes["_A_NORM"]
        )

        # Convertir fecha para rangos
        datos_interes["_FECHA_DT"] = pd.to_datetime(datos_interes["fecha"], dayfirst=True, errors="coerce")

        # ── Estandarizar tipo de transacción ──
        def estandarizar_tipo(valor):
            v = str(valor).upper().strip()
            es_sms = "SMS" in v or "MENSAJE" in v or "MMS" in v
            es_saliente = any(x in v for x in ("SALIENTE", "OUT", "MOC", "ORIGINAT"))
            if es_sms:
                return "SMS SALIENTE" if es_saliente else "SMS ENTRANTE"
            return "LLAMADA SALIENTE" if es_saliente else "LLAMADA ENTRANTE"

        tipo_col = "tipoTransaccion" if "tipoTransaccion" in datos_interes.columns else None
        if tipo_col:
            datos_interes["_TIPO"] = datos_interes[tipo_col].fillna("").apply(estandarizar_tipo)
        else:
            datos_interes["_TIPO"] = "LLAMADA ENTRANTE"

        # ── 1. Contactos frecuentes con desglose por tipo ──
        freq = (
            datos_interes.groupby("CONTACTO")
            .agg(
                frecuencia=("CONTACTO", "size"),
                primera_fecha=("_FECHA_DT", "min"),
                ultima_fecha=("_FECHA_DT", "max"),
            )
            .reset_index()
            .sort_values("frecuencia", ascending=False)
        )
        freq["primera_fecha"] = freq["primera_fecha"].dt.strftime("%d/%m/%Y").fillna("-")
        freq["ultima_fecha"] = freq["ultima_fecha"].dt.strftime("%d/%m/%Y").fillna("-")
        freq = freq[freq["CONTACTO"].str.strip() != ""].copy()

        # Pivot: una columna por tipo de transacción
        pivot = (
            datos_interes.groupby(["CONTACTO", "_TIPO"])
            .size()
            .unstack(fill_value=0)
            .reset_index()
        )
        freq = freq.merge(pivot, on="CONTACTO", how="left").fillna(0)
        # Asegurar que los conteos sean enteros
        tipo_cols_found = [c for c in freq.columns if c not in ("CONTACTO", "frecuencia", "primera_fecha", "ultima_fecha")]
        for tc in tipo_cols_found:
            freq[tc] = freq[tc].astype(int)

        contactos = freq.rename(columns={"CONTACTO": "numero"}).to_dict(orient="records")

        # ── 2. IMEIs del número objetivo (solo el lado del objetivo, con conteo) ──
        imei_counter: dict = {}
        for _, row in datos_interes.iterrows():
            a_norm = str(row.get("_A_NORM") or "").strip()
            raw = str(row.get("imeiA") if a_norm == numero_norm else row.get("imeiB") or "").strip()
            # Limpiar .0 de floats y convertir a entero string
            try:
                imei_int = str(int(float(raw)))
                if len(imei_int) >= 14 and imei_int not in ("0", "nan"):
                    imei_counter[imei_int] = imei_counter.get(imei_int, 0) + 1
            except (ValueError, OverflowError):
                pass
        imeis = [
            {"imei": k, "cantidad": v}
            for k, v in sorted(imei_counter.items(), key=lambda x: x[1], reverse=True)
        ]

        # ── 3. Georreferenciación BTS (misma lógica que experticia-form.tsx) ──
        # Agrupa por posición física (lat,lon) → antenaMap
        # Dentro de cada antena, registra las celdas BTS con frecuencia individual

        invalidos = {"", "-", "n/d", "nan", "none", "n/d, n/d", "nan, nan"}

        def parse_coordenadas(coord: str):
            parts = [p.strip() for p in coord.split(",")]
            if len(parts) >= 2:
                try:
                    def to_decimal(s: str) -> float:
                        if s.count('.') > 1:
                            sign = -1 if s.startswith('-') else 1
                            digits = s.replace('-', '').replace('.', '')
                            return sign * int(digits) / 1_000_000
                        return float(s)
                    lat, lon = to_decimal(parts[0]), to_decimal(parts[1])
                    if not (lat == 0 and lon == 0):
                        return lat, lon
                except (ValueError, ZeroDivisionError):
                    pass
            return None

        antena_map: dict = {}

        for _, row in datos_interes.iterrows():
            a_norm = str(row.get("_A_NORM") or "").strip()
            if a_norm == numero_norm:
                coord_str  = str(row.get("coordenadasA") or "").strip()
                bts_celda  = str(row.get("btsCeldaA")    or "").strip()
                direccion  = str(row.get("direccionA")   or "").strip()
                orientacion = str(row.get("orientacionA") or "-").strip() or "-"
            else:
                coord_str  = str(row.get("coordenadasB") or "").strip()
                bts_celda  = str(row.get("btsCeldaB")    or "").strip()
                direccion  = str(row.get("direccionB")   or "").strip()
                orientacion = str(row.get("orientacionB") or "-").strip() or "-"

            if coord_str.lower() in invalidos:
                continue
            parsed = parse_coordenadas(coord_str)
            if not parsed:
                continue

            coord_key = f"{parsed[0]},{parsed[1]}"
            if coord_key not in antena_map:
                antena_map[coord_key] = {"totalFisica": 0, "coordenadas": coord_str, "celdas": {}}
            antena = antena_map[coord_key]
            antena["totalFisica"] += 1

            if bts_celda and bts_celda.lower() not in invalidos:
                if bts_celda not in antena["celdas"]:
                    antena["celdas"][bts_celda] = {"frecuencia": 0, "direccion": direccion, "orientacion": orientacion}
                antena["celdas"][bts_celda]["frecuencia"] += 1

        # Serializar como filas planas (igual estructura que Excel de experticia-form.tsx):
        # Frec. Total Física | Frec. por Celda | BTS-Celda | Dirección | Coordenadas (Lat, Lon) | Orientación
        georref = []
        for antena in sorted(antena_map.values(), key=lambda x: x["totalFisica"], reverse=True):
            celdas_sorted = sorted(antena["celdas"].items(), key=lambda x: x[1]["frecuencia"], reverse=True)
            primera = True
            for celda, info in celdas_sorted:
                georref.append({
                    "frecTotalFisica": antena["totalFisica"] if primera else "",
                    "frecPorCelda": info["frecuencia"],
                    "btsCelda": celda,
                    "direccion": info["direccion"] or "—",
                    "coordenadas": antena["coordenadas"],
                    "orientacion": info["orientacion"],
                })
                primera = False

        return {
            "contactosFrecuentes": contactos,
            "imeis": imeis,
            "georref": georref,
            "totalComunicaciones": len(datos_interes),
        }

    except Exception as e:
        print(f"[ERROR] analizar-registros-db: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("[LOG] 🚀 Iniciando TER-System OSINT API...")
    print("[LOG] 📍 Servidor corriendo en: http://localhost:8001")
    print("[LOG] 📖 Documentación disponible en: http://localhost:8001/docs")
    
    uvicorn.run(
        "api_restful:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )