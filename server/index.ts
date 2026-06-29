import express, { type Request, Response, NextFunction } from "express";
import { spawn } from "child_process";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { tokenCleanupManager } from "../tools/clean";
import "./types";

const app = express();

// Trust proxy para obtener IP correcta en entornos con proxy
app.set('trust proxy', true);

app.use(express.json({ limit: '10mb' }));

// Middleware para obtener IP del cliente
app.use((req, res, next) => {
  // Función para obtener la IP real del cliente
  function getClientIp(req: any) {
    // Verificar headers de proxy primero
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      // x-forwarded-for puede contener múltiples IPs separadas por comas
      const ips = xForwardedFor.toString().split(',');
      return ips[0].trim();
    }
    
    // Verificar otros headers de proxy
    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      return xRealIp.toString();
    }
    
    // Verificar headers adicionales
    const xClientIp = req.headers['x-client-ip'];
    if (xClientIp) {
      return xClientIp.toString();
    }
    
    // Verificar connection remoteAddress
    if (req.connection?.remoteAddress) {
      return req.connection.remoteAddress;
    }
    
    // Verificar socket remoteAddress
    if (req.socket?.remoteAddress) {
      return req.socket.remoteAddress;
    }
    
    // Usar req.ip como fallback
    return req.ip || 'unknown';
  }
  
  req.clientIp = getClientIp(req);
  next();
});
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Iniciar el sistema de limpieza automática de tokens
    tokenCleanupManager.start();
    
    /* */
    // Iniciar el servicio Python API para análisis BTS
    const pythonApiPath = path.join(process.cwd(), 'server', 'model_ai', 'api_restful.py');
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3'; // Ruta al ejecutable de Python
    const pythonProcess = spawn(pythonExecutable, [pythonApiPath], { 
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    pythonProcess.stdout?.on('data', (data) => {
      log(`[Python API] ${data.toString().trim()}`);
    });
    
    pythonProcess.stderr?.on('data', (data) => {
      log(`[Python API Error] ${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      log(`[Python API] Process exited with code ${code}`);
    });
    
    log('🐍 Iniciando API Python para análisis BTS en puerto 5001');
  });
})();
