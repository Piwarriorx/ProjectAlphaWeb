import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  
  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession()
  
  // If no session, redirect to login
  if (!session) {
    redirect('/login')
  }
  
  // Also check your custom user session from localStorage won't work server-side
  // So we rely on Supabase auth session
  
  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-4 text-cyan-400 text-xl">
          Welcome to EzCrosshairX!
        </p>
        
        <form action={async () => {
          'use server'
          // Sign out from Supabase
          const supabase = await createServerSupabase()
          await supabase.auth.signOut()
          redirect('/login')
        }} className="mt-8">
          <button className="rounded-lg bg-red-600 px-6 py-2 text-white hover:bg-red-700">
            Log Out
          </button>
        </form>
      </div>
    </div>
  )
}