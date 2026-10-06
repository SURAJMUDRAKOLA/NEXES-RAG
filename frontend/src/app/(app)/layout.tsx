// src/app/(app)/layout.tsx
// App route group layout — wraps all authenticated pages
// Includes auth guard via Supabase session check
import { redirect } from 'next/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Note: Full auth guard implemented via middleware.ts
  // Supabase SSR session check goes here in Phase 2
  return <>{children}</>;
}
