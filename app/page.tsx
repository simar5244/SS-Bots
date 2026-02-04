'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl"
        >
          <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold mb-12 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
            AI Services
          </h1>
          <div className="flex gap-6 justify-center">
            <Link href="/signup">
              <button className="px-12 py-5 bg-black text-white rounded-full text-lg font-medium hover:bg-black/80 transition-all transform hover:scale-105 shadow-lg">
                Get Started
              </button>
            </Link>
            <Link href="/login">
              <button className="px-12 py-5 border-2 border-black text-black rounded-full text-lg font-medium hover:bg-black hover:text-white transition-all transform hover:scale-105">
                Login
              </button>
            </Link>
          </div>
        </motion.div>
      </main>

      <footer className="fixed bottom-0 w-full py-4 text-center text-sm text-black/40 bg-white">
        <p>Made with ❤️ by Sim</p>
      </footer>
    </div>
  )
}
