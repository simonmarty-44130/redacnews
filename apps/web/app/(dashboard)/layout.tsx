'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { logout } from '@/lib/aws/auth';
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Presentation,
  Settings,
  Radio,
  LogOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Conducteur', href: '/conducteur', icon: LayoutDashboard },
  { name: 'Sujets', href: '/sujets', icon: FileText },
  { name: 'Mediatheque', href: '/mediatheque', icon: FolderOpen },
  { name: 'Prompteur', href: '/prompteur', icon: Presentation },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Radio className="h-6 w-6 text-blue-600 animate-pulse" />
          <span className="text-lg">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  const initials = user?.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/conducteur" className="flex items-center gap-2">
              <Radio className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-lg">RedacNews</span>
            </Link>
            <nav className="flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5 text-gray-500" />
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Deconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
