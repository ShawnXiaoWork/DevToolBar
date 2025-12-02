import React, { useState } from 'react';
import { ToolConfig, ToolId, Language } from './types';
import { ClockIcon, FileJsonIcon, MenuIcon } from './components/Icons';
import { TimestampTool } from './components/TimestampTool';
import { JsonTool } from './components/JsonTool';
import { translations } from './i18n';

// Configuration for available tools (text removed, now in i18n)
const TOOLS: ToolConfig[] = [
  {
    id: 'timestamp',
    icon: <ClockIcon className="w-5 h-5" />,
  },
  {
    id: 'json',
    icon: <FileJsonIcon className="w-5 h-5" />,
  },
];

const App: React.FC = () => {
  const [activeToolId, setActiveToolId] = useState<ToolId>('timestamp');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState<Language>('zh');

  const activeTool = TOOLS.find(t => t.id === activeToolId) || TOOLS[0];
  const t = translations[lang];

  const renderTool = () => {
    switch (activeToolId) {
      case 'timestamp':
        return <TimestampTool lang={lang} />;
      case 'json':
        return <JsonTool lang={lang} />;
      default:
        return <div>Tool not found</div>;
    }
  };

  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'zh' : 'en');
  }

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-200 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-72 bg-slate-950 border-r border-slate-800
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-sky-500">
            <div className="p-2 bg-sky-500/10 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">{t.appTitle}</h1>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">{t.utilities}</div>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveToolId(tool.id);
                setIsSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200
                ${activeToolId === tool.id 
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-600/20' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}
              `}
            >
              {tool.icon}
              <div className="flex flex-col items-start">
                <span>{t.tools[tool.id].name}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-600 text-center">
             {t.builtWith}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-4 lg:px-8 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
            >
              <MenuIcon />
            </button>
            <h2 className="text-lg font-semibold text-white truncate">{t.tools[activeTool.id].name}</h2>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:block text-sm text-slate-500 truncate max-w-md text-right">
               {t.tools[activeTool.id].description}
             </div>
             
             {/* Language Toggle */}
             <button 
               onClick={toggleLang}
               className="ml-2 px-2 py-1 rounded border border-slate-700 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors"
             >
               {lang === 'en' ? '中文' : 'EN'}
             </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
           <div className="max-w-6xl mx-auto h-full">
             {renderTool()}
           </div>
        </div>

      </main>
    </div>
  );
};

export default App;
