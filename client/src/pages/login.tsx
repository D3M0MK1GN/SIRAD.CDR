//import { useState } from "react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Antenna, User, Lock, LogIn, Shield, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [inactivityMessage, setInactivityMessage] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

    // Check for inactivity timeout message
  useEffect(() => {
    const timeoutReason = localStorage.getItem('sessionTimeoutReason');
    if (timeoutReason === 'inactivity') {
      setInactivityMessage(true);
      localStorage.removeItem('sessionTimeoutReason');
      
      // Auto-hide message after 10 seconds
      const timer = setTimeout(() => {
        setInactivityMessage(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const success = await login(username, password);
      if (success) {
        // Pequeña espera para que el estado se actualice
        setTimeout(() => {
          setLocation("/dashboard");
        }, 100);
      }
    } catch (error) {
      // Error handled by useAuth hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[url('/fondo-login.png')] bg-cover bg-center bg-no-repeat flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl bg-white/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <img src="/android-chrome-512x512.png" className="h-45 w-50 flex-shrink-1" alt="Logo" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800 mb-2">
            SIRAD.CDR
          </CardTitle>
          <p className="text-gray-600">Sistema Integrado de Registros y Analisis de Datos CDR</p>
        </CardHeader>
                  {inactivityMessage && (
            <Alert className="mb-4 border-orange-200 bg-orange-50">
              <Clock className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Su sesión se cerró automáticamente por <strong>Inactividad Detectada</strong>. 
                Por favor, inicie sesión nuevamente.
              </AlertDescription>
            </Alert>
          )}
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="username" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <User className="mr-2 h-4 w-4" />
                Usuario
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Lock className="mr-2 h-4 w-4" />
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center justify-end">
              <Button variant="link" className="text-sm text-primary hover:underline p-0">
                ¿Olvidaste tu contraseña?
              </Button>
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white hover:bg-blue-700 transition-colors duration-200"
            >
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <Shield className="inline mr-1 h-4 w-4" />
            CICPC - Dios Con Nosotros / D1killer
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
