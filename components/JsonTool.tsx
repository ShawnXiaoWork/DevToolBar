import React, { useState } from 'react';
import { CopyIcon, CheckIcon, TrashIcon, MinimizeIcon, FileJsonIcon } from './Icons';

export const JsonTool: React.FC = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Helper to safely format JSON
  const formatJson = (minify: boolean) => {
    if (!jsonInput.trim()) {
      setError(null);
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      const formatted = JSON.stringify(parsed, null, minify ? 0 : 2);
      setJsonInput(formatted);
      setError(null);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Invalid JSON");
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearInput = () => {
    setJsonInput('');
    setError(null);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-wrap gap-2 justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
            <div className="text-sky-400 p-1.5 bg-sky-900/30 rounded-md">
              <FileJsonIcon className="w-5 h-5"/>
            </div>
            <span className="font-semibold text-slate-200">Editor</span>
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={() => formatJson(false)}
             className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
           >
             Beautify
           </button>
           <button 
             onClick={() => formatJson(true)}
             className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
           >
             <MinimizeIcon className="w-4 h-4"/>
             Minify
           </button>
           <button 
             onClick={copyToClipboard}
             className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
           >
             {copied ? <CheckIcon className="w-4 h-4 text-green-400"/> : <CopyIcon className="w-4 h-4"/>}
             Copy
           </button>
           <button 
             onClick={clearInput}
             className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 text-red-400 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
           >
             <TrashIcon className="w-4 h-4"/>
             Clear
           </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative flex flex-col">
        <textarea
          value={jsonInput}
          onChange={(e) => {
            setJsonInput(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Paste your JSON here..."
          className={`w-full h-full bg-slate-900 text-sm font-mono p-4 rounded-lg border focus:outline-none focus:ring-2 resize-none transition-all ${
            error 
            ? 'border-red-500 focus:ring-red-500/50 text-red-100 placeholder-red-300/30' 
            : 'border-slate-700 focus:ring-sky-500/50 text-slate-300 placeholder-slate-600'
          }`}
          spellCheck={false}
        />
        
        {/* Error Overlay / Status Bar */}
        {error && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 border border-red-700 text-white px-4 py-3 rounded-md shadow-lg backdrop-blur-sm flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="mt-0.5">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-sm">JSON Parse Error</h4>
                    <p className="text-xs font-mono mt-1 opacity-90">{error}</p>
                </div>
            </div>
        )}
        
        {/* Stats footer if no error */}
        {!error && jsonInput && (
             <div className="absolute bottom-2 right-2 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                Length: {jsonInput.length} chars
             </div>
        )}
      </div>
    </div>
  );
};