import { redirect } from "next/navigation"
import { createServerSupabase } from "@/lib/server"
import Sidebar from "@/components/Sidebar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 p-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}
