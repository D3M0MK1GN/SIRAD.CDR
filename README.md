# TER-System

Sistema de Gestión de Solicitudes de Telecomunicaciones para entidades de seguridad.

## Descripción

TER-System es una aplicación web full-stack en español diseñada para gestionar, rastrear y analizar solicitudes de telecomunicaciones dirigidas a operadores como Digitel, Movistar y Movilnet. Permite crear usuarios, administrar solicitudes, generar experticias, analizar archivos Excel (BTS, contactos frecuentes, IMEIs, georreferenciación) y consultar información asociada.

El sistema integra dos servicios principales:

- **Backend Node.js/Express + React** (puerto 5000) — gestión de usuarios, solicitudes, autenticación, dashboard y plantillas.
- **API Python con FastAPI** (puerto 8001) — análisis de datos forenses de telecomunicaciones, contactos frecuentes y georreferenciación BTS.

## Tecnologías principales

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Radix UI, shadcn/ui, Wouter, React Query, React Hook Form, Zod
- **Backend:** Node.js, Express, TypeScript, ES modules
- **Base de datos:** PostgreSQL con Drizzle ORM y Drizzle Kit
- **Autenticación:** JWT + bcrypt
- **Análisis de datos:** Python 3, FastAPI, Uvicorn, pandas, numpy, openpyxl, tabulate, requests

## Estructura del proyecto

```
.
├── client/                  # Frontend React + Vite
│   ├── src/
│   │   ├── components/      # Componentes de UI y páginas
│   │   ├── hooks/           # Hooks personalizados
│   │   ├── lib/             # Utilidades y helpers
│   │   ├── pages/           # Páginas principales
│   │   └── App.tsx          # Punto de entrada del frontend
│   └── index.html
├── server/                  # Backend Express
│   ├── index.ts             # Servidor principal
│   ├── routes.ts            # Rutas principales
│   ├── storage.ts           # Acceso a datos (Repository Pattern)
│   ├── db.ts                # Conexión a PostgreSQL
│   ├── routes-stats.ts      # Rutas de estadísticas
│   ├── routes-gest.ts       # Rutas de gestión
│   ├── model_ai/            # Modelos e integración con Python
│   │   └── api_restful.py   # API FastAPI para análisis BTS
│   └── model_ai/experticias/
│       └── identify_bts.py  # Lógica de análisis de Excel
├── shared/                  # Esquemas y tipos compartidos
│   └── schema.ts            # Esquema Drizzle ORM completo
├── osintpython/             # Scripts Python de consulta OSINT
│   └── infoI.py             # Consulta de cédulas venezolanas
├── uploads/                 # Archivos subidos al sistema
├── drizzle.config.ts        # Configuración de Drizzle Kit
├── vite.config.ts           # Configuración de Vite
├── tailwind.config.ts       # Configuración de Tailwind
├── package.json             # Dependencias y scripts de Node
└── pyproject.toml           # Dependencias Python (generado por Replit)
```

## Instalación y ejecución

### Requisitos

- Node.js 20+
- Python 3.11+ (con pip o uv)
- PostgreSQL 14+ (Replit provee una base de datos automáticamente)

### Pasos

1. **Clonar o importar el proyecto.**

2. **Instalar dependencias de Node.js:**

   ```bash
   npm install
   ```

3. **Instalar dependencias de Python:**

   ```bash
   pip install fastapi uvicorn pandas numpy tabulate requests openpyxl
   ```

   O, si usas Replit, las dependencias se instalan automáticamente desde `pyproject.toml`.

4. **Configurar variables de entorno.**

   Crea un archivo `.env` con al menos:

   ```env
   NODE_ENV=development
   PORT=5000
   JWT_SECRET=tu_clave_secreta_jwt
   GEMINI_API_KEY=tu_api_key_de_gemini
   ```

   Replit gestiona automáticamente `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` y `PGDATABASE`. En producción, usa Replit Secrets para las variables sensibles.

5. **Crear las tablas de la base de datos:**

   ```bash
   npm run db:push
   ```

6. **Crear el primer usuario administrador.**

   El sistema no incluye un usuario por defecto. Debes crear uno en la tabla `users` con rol `admin` y contraseña hasheada con bcrypt.

7. **Iniciar el servidor de desarrollo:**

   ```bash
   npm run dev
   ```

   - Frontend: `http://localhost:5000`
   - API Python: `http://localhost:8001`
   - Documentación FastAPI: `http://localhost:8001/docs`

## Scripts principales

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo con hot reload |
| `npm run build` | Compila el frontend y el backend para producción |
| `npm run start` | Ejecuta el backend compilado en producción |
| `npm run check` | Verifica tipos con TypeScript |
| `npm run db:push` | Aplica el esquema Drizzle a la base de datos |

## Notas importantes

- El sistema depende de la API Python para el análisis de Excel y consulta de cédulas. El servidor Node la levanta automáticamente en el puerto 8001.
- Las claves de API de terceros (GEMINI_API_KEY, APP_ID, TOKEN de cédulas) deben mantenerse como secretos; no se recomienda dejarlas en el código fuente.
- El esquema de base de datos está definido en `shared/schema.ts` e incluye tablas de usuarios, solicitudes, experticias, personas/casos, registros de comunicación, plantillas y más.

## Licencia

MIT
