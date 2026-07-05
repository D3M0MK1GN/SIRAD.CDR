import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useSidebarContext } from "@/hooks/use-sidebar-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import {
  LayoutDashboard,
  FileText,
  Mail,
  User,
  LogOut,
  Antenna,
  Users,
  Menu,
  X,
  Bot,
  Atom,
  GitBranch,
} from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "canViewDashboard" as const,
  },
  {
    title: "Gestión de Solicitudes",
    href: "/solicitudes",
    icon: FileText,
    permission: "canViewAllRequests" as const,
  },
  {
    title: "Gestión de Experticias",
    href: "/experticias",
    icon: Atom,
    permission: "canViewAllRequests" as const,
  },
  {
    title: "Análisis de Trazabilidad",
    href: "/trazabilidad",
    icon: GitBranch,
    permission: "canViewAllRequests" as const,
  },
  {
    title: "Enviar Correo",
    href: "/plantillas",
    icon: Mail,
    permission: "canViewEmailTemplates" as const,
  },
  {
    title: "Chatbot",
    href: "/chatbot",
    icon: Bot,
    permission: "canViewDashboard" as const,
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const permissions = usePermissions();
  const { isOpen, toggle } = useSidebarContext();

  // Memoize nav items to prevent unnecessary re-renders
  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (
        item.permission === "canViewAllRequests" &&
        item.href === "/solicitudes"
      ) {
        // For requests, both admins and supervisors can view all, users can view their own
        return permissions.canViewAllRequests || permissions.canViewDashboard;
      }
      if (
        item.permission === "canViewEmailTemplates" &&
        item.href === "/plantillas"
      ) {
        // For email templates, only admins can access this section
        return permissions.canViewEmailTemplates;
      }
      return permissions[item.permission];
    });
  }, [permissions]);

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 bg-white shadow-lg transition-all duration-300 z-50",
        isOpen ? "w-64" : "w-16"
      )}
    >
      {/* Header with toggle button */}
      <div className="flex items-center justify-between h-16 bg-primary text-white px-4">
        <div className="flex items-center space-x-3">
          {/* <Antenna className="h-6 w-6 flex-shrink-0" /> */}
          {/*<Cambiar logo del panel Lateral y ajustar tamaño /> */}
          <img
            src="/cicipc.png"
            className="h-12 w-12 flex-shrink-0"
            alt="Logo"
          />
          {isOpen && <span className="font-bold text-lg">SIRAD.CDR</span>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="text-white hover:bg-primary-dark p-2"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="mt-4">
        <div className="px-2 space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full h-auto font-normal transition-all duration-200",
                    isOpen
                      ? "justify-start px-4 py-3"
                      : "justify-center px-2 py-3",
                    isActive && "bg-blue-50 text-primary hover:bg-blue-50"
                  )}
                  title={!isOpen ? item.title : undefined}
                >
                  <Icon className={cn("h-4 w-4", isOpen && "mr-3")} />
                  {isOpen && <span className="truncate">{item.title}</span>}
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User info and logout */}
      <div className="absolute bottom-0 w-full p-2 border-t">
        {isOpen && (
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user?.nombre}</p>
              <p className="text-xs text-gray-500 truncate">{user?.rol}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={logout}
          className={cn(
            "w-full text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200",
            isOpen ? "justify-start px-4 py-2" : "justify-center px-2 py-2"
          )}
          title={!isOpen ? "Cerrar Sesión" : undefined}
        >
          <LogOut className={cn("h-4 w-4", isOpen && "mr-3")} />
          {isOpen && "Cerrar Sesión"}
        </Button>
      </div>
    </div>
  );
}
