import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AdminSidebar } from '@/components/AdminSidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ECサイト 管理者ポータル',
  description: 'リアルタイム分析と管理機能でECプラットフォームを管理',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50 flex">
          {/* Sidebar */}
          <div className="hidden md:flex md:w-64 md:flex-col">
            <AdminSidebar />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Top Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
              <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center">
                    <h1 className="text-xl font-semibold text-gray-900 md:hidden">
                      管理者ポータル
                    </h1>
                    <h1 className="hidden md:block text-2xl font-bold text-gray-900">
                      ECサイト 管理システム
                    </h1>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>システム正常</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 hidden sm:inline">管理者</span>
                      <div className="w-8 h-8 bg-admin-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">👤</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto">
              <div className="px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
              <div className="text-center text-sm text-gray-500">
                <p>&copy; 2025 ECプラットフォーム 管理者ポータル. Next.js と Kafka で構築されています。</p>
                <p className="mt-1">リアルタイム在庫・注文管理</p>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  )
}