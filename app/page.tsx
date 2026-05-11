import { createServerSupabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  // Session check is handled by proxy.ts middleware
  // This page only renders if authenticated
  
  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-4 text-cyan-400 text-xl">
          Welcome to EzCrosshairX!
        </p>
        
        <form action={async () => {
          'use server'
          // Clear cookie
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