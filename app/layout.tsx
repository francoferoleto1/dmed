import { redirect } from "next/navigation"
import { createServerSupabase } from "@/lib/server"
import MainContent from "@/components/MainContent"
import Sidebar from "@/components/Sidebar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MainContent>{children}</MainContent>
    </div>
  )
}
