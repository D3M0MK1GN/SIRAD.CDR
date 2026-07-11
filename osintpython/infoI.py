import requests
import json
import os
from datetime import datetime

# --- Configuración de la API ---
# ¡IMPORTANTE! Reemplaza estos valores con tu APP-ID y TOKEN reales
APP_ID = "9314"  # Reemplaza con tu APP-ID
TOKEN = "15f625d3f55b6749c7a54c54b6235c98" # Reemplaza con tu TOKEN
BASE_URL = "http://api.cedula.com.ve/api/v1"

# Nombre del archivo donde se guardarán las consultas
LOG_FILE = "consultas_cedulas.json"

def cargar_logs():
    """Carga las consultas existentes desde el archivo JSON."""
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                # Si el archivo está vacío o corrupto, retorna una lista vacía
                return []
    return []

def guardar_logs(logs):
    """Guarda las consultas en el archivo JSON."""
    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(logs, f, indent=4, ensure_ascii=False)

def consultar_cedula():
    """
    Función principal para solicitar datos de cédula y guardar la consulta.
    """
    print("--- Consulta de Cédula ---")

    nacionalidad = input("Ingrese la nacionalidad (V para Venezolano, E para Extranjero): ").strip().upper()
    while nacionalidad not in ['V', 'E']:
        print("Nacionalidad inválida. Por favor, ingrese 'V' o 'E'.")
        nacionalidad = input("Ingrese la nacionalidad (V para Venezolano, E para Extranjero): ").strip().upper()

    cedula = input("Ingrese el número de cédula: ").strip()
    while not cedula.isdigit() or not cedula:
        print("Número de cédula inválido. Por favor, ingrese solo dígitos.")
        cedula = input("Ingrese el número de cédula: ").strip()

    # Construir la URL de la consulta
    url = f"{BASE_URL}?app_id={APP_ID}&token={TOKEN}&nacionalidad={nacionalidad}&cedula={cedula}"

    print(f"\nRealizando Busqueda")

    # Realizar la petición HTTP
    try:
        response = requests.get(url)
        response.raise_for_status()  # Lanza una excepción para errores HTTP (4xx o 5xx)
        data = response.json()

        print("\n--- Resultado de la Consulta ---")
        if data:
            print(json.dumps(data, indent=4, ensure_ascii=False)) # Imprime el JSON formateado
        else:
            print("No se recibió respuesta de la API.")

        # Preparar la entrada para el log
        consulta_registro = {
            "timestamp": datetime.now().isoformat(),
            "nacionalidad_consultada": nacionalidad,
            "cedula_consultada": cedula,
            "url_completa": url,
            "resultado_api": data # Guardamos la respuesta completa de la API
        }

        # Cargar logs existentes, añadir la nueva consulta y guardar
        logs = cargar_logs()
        logs.append(consulta_registro)
        guardar_logs(logs)
        print(f"\nConsulta guardada en '{LOG_FILE}' exitosamente.")

    except requests.exceptions.RequestException as e:
        print(f"\nError al conectar con la API: {e}")
        # Registrar el error también en el log si es deseable
        error_registro = {
            "timestamp": datetime.now().isoformat(),
            "nacionalidad_consultada": nacionalidad,
            "cedula_consultada": cedula,
            "url_completa": url,
            "error": str(e)
        }
        logs = cargar_logs()
        logs.append(error_registro)
        guardar_logs(logs)

    except json.JSONDecodeError:
        print("\nError: La respuesta de la API no es un JSON válido.")
        print(f"Respuesta cruda: {response.text}")
        # Puedes decidir guardar la respuesta cruda también si es un error de formato

if __name__ == "__main__":
    consultar_cedula()
