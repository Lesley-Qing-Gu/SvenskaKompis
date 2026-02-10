
import React from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="nordic-gradient text-white py-6 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-800 font-bold text-xl shadow-inner">
              🇸🇪
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SvenskaKompis</h1>
              <p className="text-sm opacity-80 font-light">Your Personal Swedish Language Coach</p>
            </div>
          </div>
          <div className="hidden md:block text-xs font-mono bg-white/10 px-3 py-1 rounded-full">
            Heja Sverige! 🇸🇪
          </div>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto max-w-4xl p-4 md:p-8">
        {children}
      </main>

      <footer className="bg-slate-100 py-8 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            Powered by Gemini 3 & SvenskaKompis AI. Tack så mycket!
          </p>
          <div className="flex justify-center gap-4 mt-4 text-slate-400">
            <i className="fa-brands fa-github hover:text-blue-600 cursor-pointer"></i>
            <i className="fa-brands fa-linkedin hover:text-blue-600 cursor-pointer"></i>
          </div>
        </div>
      </footer>
    </div>
  );
};
