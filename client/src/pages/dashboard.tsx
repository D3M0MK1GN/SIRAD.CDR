import { useState, useEffect, memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Layout } from "@/components/layout";
import { StatsCards } from "@/components/stats-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Plus, Edit, Mail, Clock, LayoutDashboard, Users, Settings, FileText, BarChart3, QrCode, TrendingUp, Calendar } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { UserTable } from "@/components/user-table";
import { UserForm } from "@/components/user-form";
import { PlantillasWordAdmin } from "@/components/plantillas-word-admin";
import ChatbotAdmin from "@/components/chatbot-admin";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";

interface DashboardStats {
  totalSolicitudes: number;
  pendientes: number;
  enviadas: number;
  respondidas: number;
  rechazadas: number;
  solicitudesPorOperador: { operador: string; total: number }[];
  actividadReciente: any[];
  tiempoPromedioDias: number;
  totalExperticias: number;
  experticiasCompletadas: number;
  tasaEficienciaCombinada: number;
}

interface UserFormData {
  username: string;
  nombre: string;
  email?: string;
  rol: string;
  status: string;
  direccionIp?: string;
  password?: string;
  tiempoSuspension?: string;
  motivoSuspension?: string;
}

// 🚀 Optimized memoized components for dashboard performance
const NavigationButton = memo(function NavigationButton({ 
  isActive, 
  onClick, 
  icon: Icon, 
  title, 
  subtitle, 
  color 
}: {
  isActive: boolean;
  onClick: () => void;
  icon: any;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <button 
      className={`flex items-center space-x-2 px-3 py-2 text-left rounded-lg transition-colors ${
        isActive
          ? `bg-${color}-50 border border-${color}-200 text-${color}-700` 
          : 'hover:bg-gray-50 border border-transparent'
      }`}
      onClick={onClick}
    >
      <div className={`p-1.5 rounded bg-${color}-100`}>
        <Icon className={`h-4 w-4 text-${color}-600`} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </button>
  );
});

const ReportCard = memo(function ReportCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  iconColor, 
  trend, 
  trendText, 
  trendColor 
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  iconColor: string;
  trend: string;
  trendText: string;
  trendColor: string;
}) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`${color} p-3 rounded-full`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className={`flex items-center ${trendColor}`}>
            <TrendingUp className="mr-1 h-3 w-3" />
            {trend}
          </span>
          {trendText && (
            <span className="text-gray-600 ml-2">{trendText}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default function Dashboard() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [location, navigate] = useLocation();
  const searchParams = useSearch();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Get the view from URL parameters, default to dashboard
  const currentView = new URLSearchParams(searchParams).get('view') || 'dashboard';
  const showUserManagement = currentView === 'users';
  const showPlantillasWordAdmin = currentView === 'plantillas-word';
  const showChatbotAdmin = currentView === 'chatbot-admin';
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Function to change views with URL update
  const setView = (view: string) => {
    const params = new URLSearchParams();
    if (view !== 'dashboard') {
      params.set('view', view);
    }
    const search = params.toString();
    navigate(`/dashboard${search ? `?${search}` : ''}`);
  };
  
  // For users, fetch stats by their coordination, for admins/supervisors fetch all
  const statsEndpoint = "/api/dashboard/stats";
    
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: [statsEndpoint],
    refetchInterval: 40000, // Refresh every 40 seconds
  });

  const { data: activeUsersData } = useQuery<{ activeUsers: number }>({
    queryKey: ["/api/users/active-count"],
    refetchInterval: 20000, // Refresh every 20 seconds
  });

  const { data: experticiasStats, isLoading: experticiasLoading } = useQuery<{
    total: number; completadas: number; procesando: number; qr_ausente: number;
  }>({
    queryKey: ["/api/experticias/stats"],
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest(`/api/users?page=1&limit=50`),
    enabled: permissions.canManageUsers && showUserManagement,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario.",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UserFormData }) => {
      return apiRequest(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast({
        title: "Usuario actualizado",
        description: "El usuario ha sido actualizado exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/users/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      deleteUserMutation.mutate(id);
    }
  };

  const handleCreateUser = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  const handleUpdateUser = (data: UserFormData) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    }
  };

  // 🚀 Memoized calculations for performance optimization
  const reportStatsData = useMemo(() => {
    if (!stats) return null;
    
    const getCombinedEfficiencyRate = () => stats.tasaEficienciaCombinada || 0;
    const getAverageTime = () => {
      if (stats.tiempoPromedioDias === 0) return "Sin datos";
      return `${stats.tiempoPromedioDias} días`;
    };

    return [
      {
        title: "Tasa de Eficiencia",
        value: `${getCombinedEfficiencyRate()}%`,
        icon: BarChart3,
        color: "bg-green-100",
        iconColor: "text-green-600",
        trend: getCombinedEfficiencyRate() > 80 ? "Excelente" : getCombinedEfficiencyRate() > 60 ? "Buena" : "Mejorable",
        trendText: "solicitudes + experticias",
        trendColor: getCombinedEfficiencyRate() > 80 ? "text-green-600" : getCombinedEfficiencyRate() > 60 ? "text-yellow-600" : "text-red-600",
      },
      {
        title: "Tiempo Promedio",
        value: getAverageTime(),
        icon: Calendar,
        color: "bg-orange-100",
        iconColor: "text-orange-600",
        trend: stats.tiempoPromedioDias && stats.tiempoPromedioDias < 7 ? "Eficiente" : stats.tiempoPromedioDias && stats.tiempoPromedioDias < 14 ? "Moderado" : "Lento",
        trendText: "de procesamiento",
        trendColor: stats.tiempoPromedioDias && stats.tiempoPromedioDias < 7 ? "text-green-600" : stats.tiempoPromedioDias && stats.tiempoPromedioDias < 14 ? "text-yellow-600" : "text-red-600",
      },
      {
        title: "Usuarios Activos",
        value: activeUsersData?.activeUsers || 0,
        icon: Users,
        color: "bg-purple-100",
        iconColor: "text-purple-600",
        trend: "En línea",
        trendText: "",
        trendColor: "text-purple-600",
      },
    ];
  }, [stats, activeUsersData]);

  const navigationConfig = useMemo(() => [
    {
      key: 'dashboard',
      isActive: !showUserManagement && !showPlantillasWordAdmin && !showChatbotAdmin,
      icon: LayoutDashboard,
      title: "Dashboard",
      subtitle: "Estadísticas del sistema",
      color: "blue",
      onClick: () => setView('dashboard'),
      requiresPermission: false,
    },
    {
      key: 'users',
      isActive: showUserManagement,
      icon: Users,
      title: "Administrador de Usuarios", 
      subtitle: "Gestionar usuarios",
      color: "green",
      onClick: () => setView('users'),
      requiresPermission: true,
    },
    {
      key: 'plantillas-word',
      isActive: showPlantillasWordAdmin,
      icon: FileText,
      title: "Plantillas Word",
      subtitle: "Gestionar plantillas de documentos",
      color: "purple", 
      onClick: () => setView('plantillas-word'),
      requiresPermission: true,
    },
    {
      key: 'chatbot-admin',
      isActive: showChatbotAdmin,
      icon: Settings,
      title: "Administrar Chatbot",
      subtitle: "Gestionar límites y acceso al chatbot",
      color: "orange",
      onClick: () => setView('chatbot-admin'),
      requiresPermission: true,
    },
  ], [showUserManagement, showPlantillasWordAdmin, showChatbotAdmin, setView]);

  if (isLoading || experticiasLoading) {
    return (
      <Layout title="Panel de Control" subtitle="Cargando estadísticas...">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando estadísticas...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout title="Panel de Control" subtitle="Error cargando datos">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <p className="text-gray-600">Error cargando estadísticas</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Panel de Control" subtitle="Gestion del Sistema">
      <div className="p-6">
        {/* 🚀 Optimized Quick Access Buttons */}
        <div className="mb-6 flex gap-3">
          {navigationConfig.map((nav) => (
            (!nav.requiresPermission || permissions.canManageUsers) && (
              <NavigationButton
                key={nav.key}
                isActive={nav.isActive}
                onClick={nav.onClick}
                icon={nav.icon}
                title={nav.title}
                subtitle={nav.subtitle}
                color={nav.color}
              />
            )
          ))}
        </div>
        
        {/* Main Content */}
        {!showUserManagement && !showPlantillasWordAdmin && !showChatbotAdmin ? (
          <>
            {/* 🚀 Optimized Reports Stats Cards - Solo para Admin y Supervisor */}
            {permissions.canViewAllReports && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de Reportes</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                  {reportStatsData?.map((card, index) => (
                    <ReportCard
                      key={index}
                      title={card.title}
                      value={card.value}
                      icon={card.icon}
                      color={card.color}
                      iconColor={card.iconColor}
                      trend={card.trend}
                      trendText={card.trendText}
                      trendColor={card.trendColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de Solicitudes</h3>
              <StatsCards stats={stats ? {
                totalSolicitudes: stats.totalSolicitudes,
                pendientes: stats.pendientes,
                enviadas: stats.enviadas,
                respondidas: stats.respondidas,
                rechazadas: stats.rechazadas
              } : {
                totalSolicitudes: 0,
                pendientes: 0,
                enviadas: 0,
                respondidas: 0,
                rechazadas: 0
              }} />

              {/* Estado de Solicitudes y Métricas Adicionales */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Estado de Solicitudes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                      Estado de Solicitudes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { label: "Procesando", value: stats?.pendientes || 0, color: "bg-yellow-500" },
                        { label: "Enviadas", value: stats?.enviadas || 0, color: "bg-blue-500" },
                        { label: "Respondidas", value: stats?.respondidas || 0, color: "bg-green-500" },
                        { label: "Rechazadas", value: stats?.rechazadas || 0, color: "bg-red-500" },
                      ].map((item) => {
                        const percentage = (stats?.totalSolicitudes || 0) > 0 
                          ? (item.value / (stats?.totalSolicitudes || 1)) * 100 
                          : 0;
                        
                        return (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-4 h-4 ${item.color} rounded-full`}></div>
                              <span className="text-sm font-medium text-gray-700">
                                {item.label}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="w-32">
                                <Progress value={percentage} className="h-2" />
                              </div>
                              <span className="text-sm font-medium text-gray-900 w-12 text-right">
                                {item.value}
                              </span>
                              <span className="text-sm text-gray-600 w-12 text-right">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Stats Cards for Solicitudes */}
                <div className="grid grid-cols-1 gap-4">
                  {(() => {
                    const getEfficiencyRate = () => {
                      if (!stats || stats.totalSolicitudes === 0) return 0;
                      return Math.round((stats.respondidas / stats.totalSolicitudes) * 100);
                    };

                    const additionalSolicitudesCards = [
                      {
                        title: "Tasa de Eficiencia",
                        value: `${getEfficiencyRate()}%`,
                        icon: BarChart3,
                        color: "bg-green-100",
                        iconColor: "text-green-600",
                        trend: getEfficiencyRate() > 80 ? "Excelente" : getEfficiencyRate() > 60 ? "Buena" : "Mejorable",
                        trendText: "rendimiento",
                        trendColor: getEfficiencyRate() > 80 ? "text-green-600" : getEfficiencyRate() > 60 ? "text-yellow-600" : "text-red-600",
                      },
                      {
                        title: "Tiempo Promedio",
                        value: "5.2 días",
                        icon: Calendar,
                        color: "bg-orange-100",
                        iconColor: "text-orange-600",
                        trend: "De procesamiento",
                        trendText: "",
                        trendColor: "text-orange-600",
                      },
                    ];

                    return additionalSolicitudesCards.map((card, index) => {
                      const Icon = card.icon;
                      return (
                        <Card key={index} className="border border-gray-200">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                              </div>
                              <div className={`${card.color} p-3 rounded-full`}>
                                <Icon className={`h-5 w-5 ${card.iconColor}`} />
                              </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm">
                              <span className={`flex items-center ${card.trendColor}`}>
                                <TrendingUp className="mr-1 h-3 w-3" />
                                {card.trend}
                              </span>
                              {card.trendText && (
                                <span className="text-gray-600 ml-2">{card.trendText}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Experticias Stats Cards - Solo para Admin y Supervisor */}
            {permissions.canViewAllReports && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de Experticias</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(() => {
                  const total = experticiasStats?.total || 0;
                  const completadas = experticiasStats?.completadas || 0;
                  const procesando = experticiasStats?.procesando || 0;
                  const qrAusente = experticiasStats?.qr_ausente || 0;

                  const experticiasCards = [
                    {
                      title: "Total Experticias",
                      value: total,
                      icon: BarChart3,
                      color: "bg-blue-100",
                      iconColor: "text-blue-600",
                      trend: "+8%",
                      trendText: "vs mes anterior",
                      trendColor: "text-green-600",
                    },
                    {
                      title: "Completadas",
                      value: completadas,
                      icon: CheckCircle,
                      color: "bg-green-100",
                      iconColor: "text-green-600",
                      trend: completadas > 0 ? `${total > 0 ? Math.round((completadas / total) * 100) : 0}%` : "Sin completar",
                      trendText: completadas > 0 ? "tasa de éxito" : "",
                      trendColor: completadas > 0 ? "text-green-600" : "text-gray-600",
                    },
                    {
                      title: "Procesando",
                      value: procesando,
                      icon: Clock,
                      color: "bg-yellow-100",
                      iconColor: "text-yellow-600",
                      trend: "En proceso",
                      trendText: "",
                      trendColor: "text-yellow-600",
                    },
                    {
                      title: "QR Ausente",
                      value: qrAusente,
                      icon: QrCode,
                      color: "bg-orange-100",
                      iconColor: "text-orange-600",
                      trend: qrAusente > 0 ? "Pendiente revisión" : "Todas completas",
                      trendText: "",
                      trendColor: qrAusente > 0 ? "text-orange-600" : "text-green-600",
                    },
                  ];

                  return experticiasCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                      <Card key={index} className="border border-gray-200">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-600">{card.title}</p>
                              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                            </div>
                            <div className={`${card.color} p-3 rounded-full`}>
                              <Icon className={`h-5 w-5 ${card.iconColor}`} />
                            </div>
                          </div>
                          <div className="mt-4 flex items-center text-sm">
                            <span className={`flex items-center ${card.trendColor}`}>
                              <TrendingUp className="mr-1 h-3 w-3" />
                              {card.trend}
                            </span>
                            {card.trendText && (
                              <span className="text-gray-600 ml-2">{card.trendText}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  });
                })()}
              </div>

              {/* Estado de Experticias y Métricas Adicionales */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Estado de Experticias */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                      Estado de Experticias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(() => {
                        const total = experticiasStats?.total || 0;
                        const completadas = experticiasStats?.completadas || 0;
                        const procesando = experticiasStats?.procesando || 0;
                        const qrAusente = experticiasStats?.qr_ausente || 0;

                        const estadoExperticias = [
                          { label: "Completadas", value: completadas, color: "bg-green-500" },
                          { label: "Procesando", value: procesando, color: "bg-yellow-500" },
                          { label: "QR Ausente", value: qrAusente, color: "bg-orange-500" },
                        ];

                        return estadoExperticias.map((item) => {
                          const percentage = total > 0 ? (item.value / total) * 100 : 0;
                          
                          return (
                            <div key={item.label} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`w-4 h-4 ${item.color} rounded-full`}></div>
                                <span className="text-sm font-medium text-gray-700">
                                  {item.label}
                                </span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="w-32">
                                  <Progress value={percentage} className="h-2" />
                                </div>
                                <span className="text-sm font-medium text-gray-900 w-12 text-right">
                                  {item.value}
                                </span>
                                <span className="text-sm text-gray-600 w-12 text-right">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Stats Cards for Experticias */}
                <div className="grid grid-cols-1 gap-4">
                  {(() => {
                    const total = experticiasStats?.total || 0;
                    const completadas = experticiasStats?.completadas || 0;

                    const getExperticiasEfficiencyRate = () => {
                      if (total === 0) return 0;
                      return Math.round((completadas / total) * 100);
                    };

                    const additionalExperticiasCards = [
                      {
                        title: "Tasa de Eficiencia",
                        value: `${getExperticiasEfficiencyRate()}%`,
                        icon: BarChart3,
                        color: "bg-green-100",
                        iconColor: "text-green-600",
                        trend: getExperticiasEfficiencyRate() > 80 ? "Excelente" : getExperticiasEfficiencyRate() > 60 ? "Buena" : "Mejorable",
                        trendText: "de completadas",
                        trendColor: getExperticiasEfficiencyRate() > 80 ? "text-green-600" : getExperticiasEfficiencyRate() > 60 ? "text-yellow-600" : "text-red-600",
                      },
                      {
                        title: "Tiempo Promedio",
                        value: "3.8 días",
                        icon: Calendar,
                        color: "bg-orange-100",
                        iconColor: "text-orange-600",
                        trend: "De análisis",
                        trendText: "",
                        trendColor: "text-orange-600",
                      },
                    ];

                    return additionalExperticiasCards.map((card, index) => {
                      const Icon = card.icon;
                      return (
                        <Card key={index} className="border border-gray-200">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                              </div>
                              <div className={`${card.color} p-3 rounded-full`}>
                                <Icon className={`h-5 w-5 ${card.iconColor}`} />
                              </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm">
                              <span className={`flex items-center ${card.trendColor}`}>
                                <TrendingUp className="mr-1 h-3 w-3" />
                                {card.trend}
                              </span>
                              {card.trendText && (
                                <span className="text-gray-600 ml-2">{card.trendText}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
            )}

            {/* Charts and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Traffic by Operator Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    Tráfico por Operador
                  </CardTitle>
                  <Select defaultValue="ultimo-mes">
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ultima-semana">Última semana</SelectItem>
                      <SelectItem value="ultimo-mes">Último mes</SelectItem>
                      <SelectItem value="ultimo-6-meses">Último 6 meses</SelectItem>
                      <SelectItem value="ultimo-12-meses">Último 12 meses</SelectItem>
                      <SelectItem value="sin-filtro">Sin filtro</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(stats?.solicitudesPorOperador || []).length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        No hay datos de tráfico disponibles
                      </div>
                    ) : (
                      (stats?.solicitudesPorOperador || []).map((item: any, index: number) => {
                        const colors = [
                          "bg-blue-500",   // Digitel
                          "bg-green-500",  // Movistar
                          "bg-red-500",    // Movilnet
                        ];
                        const percentage = (stats?.totalSolicitudes || 0) > 0 
                          ? (item.total / (stats?.totalSolicitudes || 1)) * 100 
                          : 0;
                        
                        return (
                          <div key={item.operador} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-4 h-4 ${colors[index % colors.length]} rounded-full`}></div>
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {item.operador}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Progress value={percentage} className="w-32" />
                              <span className="text-sm font-medium text-gray-900">
                                {item.total}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    Actividad Reciente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(stats?.actividadReciente || []).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No hay actividad reciente
                      </div>
                    ) : (
                      (stats?.actividadReciente || []).map((activity: any, index: number) => {
                        const icons = {
                          completado: { icon: CheckCircle, color: "bg-green-100 text-green-600" },
                          procesando: { icon: Clock, color: "bg-yellow-100 text-yellow-600" },
                          enviada: { icon: Mail, color: "bg-blue-100 text-blue-600" },
                          rechazada: { icon: Edit, color: "bg-red-100 text-red-600" },
                        };
                        
                        const iconInfo = icons[activity.estado as keyof typeof icons] || icons.procesando;
                        const Icon = iconInfo.icon;
                        
                        return (
                          <div key={index} className="flex items-start space-x-3">
                            <div className={`${iconInfo.color} p-2 rounded-full`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">
                                Solicitud #{activity.numeroSolicitud} - {activity.estado}
                              </p>
                              <p className="text-xs text-gray-500">
                                Operador: {activity.operador} - {
                                  new Date(activity.updatedAt).toLocaleString()
                                }
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-4 text-center">
                    <Button variant="link" className="text-sm text-primary hover:underline">
                      Ver toda la actividad
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : showUserManagement ? (
          /* User Management Full View */
          <div className="max-w-full overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Administrador de Usuarios</h2>
                <p className="text-gray-600">Gestiona todos los usuarios del sistema</p>
              </div>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Agregar Usuario</span>
              </Button>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-6">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-gray-600">Cargando usuarios...</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <UserTable
                      users={usersData?.users || []}
                      total={usersData?.users?.length || 0}
                      currentPage={1}
                      pageSize={50}
                      onPageChange={() => {}}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : showPlantillasWordAdmin ? (
          /* Plantillas Word Admin Full View */
          <div className="max-w-full overflow-hidden">
            <PlantillasWordAdmin />
          </div>
        ) : showChatbotAdmin ? (
          /* Chatbot Admin Full View */
          <div className="max-w-full overflow-hidden">
            <ChatbotAdmin />
          </div>
        ) : null}
      </div>
      
      {/* User Creation Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <UserForm
            onSubmit={handleCreateUser}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createUserMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* User Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <UserForm
            user={editingUser}
            onSubmit={handleUpdateUser}
            onCancel={() => setIsEditDialogOpen(false)}
            isLoading={updateUserMutation.isPending}
            isEdit={true}
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
}