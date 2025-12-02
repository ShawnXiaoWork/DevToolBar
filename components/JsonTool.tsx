import React, { useState, useRef, useMemo } from 'react';
import { CopyIcon, CheckIcon, TrashIcon, MinimizeIcon, FileJsonIcon, PlusCircleIcon, MinusCircleIcon } from './Icons';
import { Language } from '../types';
import { translations } from '../i18n';

interface JsonNodeProps {
  name?: string;
  value: any;
  isLast: boolean;
  level?: number;
  initiallyExpanded?: boolean;
}

// --- Recursive JSON Node Component ---
const JsonNode: React.FC<JsonNodeProps> = ({ 
  name, 
  value, 
  isLast, 
  level = 0,
  initiallyExpanded = true
}) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const isEmpty = isObject && (isArray ? value.length === 0 : Object.keys(value).length === 0);

  // Styling for indentation
  const indentStyle = { marginLeft: `${level === 0 ? 0 : 1.5}rem` };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const renderKey = () => {
    if (name === undefined) return null;
    return (
      <span className="text-purple-400 font-semibold mr-1">
        "{name}"
        <span className="text-slate-400">:</span>
      </span>
    );
  };

  const renderValue = (val: any) => {
    if (val === null) return <span className="text-slate-500 italic">null</span>;
    if (typeof val === 'string') return <span className="text-emerald-400">"{val}"</span>;
    if (typeof val === 'number') return <span className="text-sky-400">{val}</span>;
    if (typeof val === 'boolean') return <span className="text-rose-400 font-medium">{val.toString()}</span>;
    return <span className="text-slate-400">{String(val)}</span>;
  };

  if (isObject) {
    const keys = Object.keys(value);
    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';
    const length = isArray ? value.length : keys.length;

    return (
      <div style={level > 0 ? indentStyle : {}} className="font-mono text-sm leading-6">
        <div className="flex items-start group">
           {/* Toggle Icon */}
           {!isEmpty && (
             <button 
               onClick={handleToggle}
               className="mr-1 mt-1 text-slate-500 hover:text-slate-200 transition-colors focus:outline-none"
             >
               {expanded ? <MinusCircleIcon className="w-3.5 h-3.5" /> : <PlusCircleIcon className="w-3.5 h-3.5" />}
             </button>
           )}
           {/* Placeholder for alignment if empty */}
           {isEmpty && <span className="w-4.5 mr-1 inline-block"></span>}

           <div className="flex-1 break-all">
             {renderKey()}
             <span className="text-slate-300 font-bold hover:text-white cursor-pointer" onClick={!isEmpty ? handleToggle : undefined}>
                {openChar}
             </span>
             
             {!expanded && !isEmpty && (
               <span 
                 onClick={handleToggle}
                 className="text-slate-500 mx-2 cursor-pointer hover:text-slate-400 text-xs bg-slate-800/50 px-1 rounded select-none"
               >
                 {isArray ? `Array(${length})` : `Object{...}`}
               </span>
             )}

             {/* Expanded Content */}
             {expanded && !isEmpty && (
               <div className="my-0.5">
                 {keys.map((key, index) => {
                   const childValue = value[isArray ? Number(key) : key];
                   const isChildLast = index === keys.length - 1;
                   return (
                     <JsonNode 
                        key={key} 
                        name={isArray ? undefined : key} 
                        value={childValue} 
                        isLast={isChildLast} 
                        level={level + 1}
                     />
                   );
                 })}
               </div>
             )}

             {(!expanded || isEmpty) ? (
                <span className="text-slate-300 font-bold">{closeChar}</span>
             ) : (
                <div style={indentStyle}>
                    <span className="text-slate-300 font-bold">{closeChar}</span>
                    {!isLast && <span className="text-slate-400">,</span>}
                </div>
             )}

             {/* Comma for collapsed state or single line objects */}
             {(!expanded || isEmpty) && !isLast && <span className="text-slate-400">,</span>}
           </div>
        </div>
      </div>
    );
  }

  // Primitive Values
  return (
    <div style={indentStyle} className="font-mono text-sm leading-6 flex items-start">
      {/* Spacer for alignment with collapsible nodes */}
      <span className="w-4.5 mr-1 inline-block"></span> 
      <div className="break-all">
        {renderKey()}
        {renderValue(value)}
        {!isLast && <span className="text-slate-400">,</span>}
      </div>
    </div>
  );
};


// --- Main Tool Component ---
interface JsonToolProps {
  lang: Language;
}

export const JsonTool: React.FC<JsonToolProps> = ({ lang }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const t = translations[lang].json;

  // Sync scroll between textarea and pre highlight layer
  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

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
        setError(t.invalidJson);
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
  
  // Syntax Highlighting for the Editor
  const highlightJSON = (code: string) => {
    if (!code) return '';
    const safeCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return safeCode.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'text-amber-400';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-sky-400 font-semibold';
          } else {
            cls = 'text-emerald-400';
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-rose-400 font-medium';
        } else if (/null/.test(match)) {
          cls = 'text-slate-500 italic';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  // Live Parse for Tree View
  const parsedData = useMemo(() => {
    if (!jsonInput.trim()) return null;
    try {
      return JSON.parse(jsonInput);
    } catch (e) {
      return null;
    }
  }, [jsonInput]);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-wrap gap-2 justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-2">
            <div className="text-sky-400 p-1.5 bg-sky-900/30 rounded-md">
              <FileJsonIcon className="w-5 h-5"/>
            </div>
            <span className="font-semibold text-slate-200">{t.title}</span>
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={() => formatJson(false)}
             className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
           >
             {t.beautify}
           </button>
           <button 
             onClick={() => formatJson(true)}
             className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
           >
             <MinimizeIcon className="w-4 h-4"/>
             {t.minify}
           </button>
           <button 
             onClick={copyToClipboard}
             className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
           >
             {copied ? <CheckIcon className="w-4 h-4 text-green-400"/> : <CopyIcon className="w-4 h-4"/>}
             {t.copy}
           </button>
           <button 
             onClick={clearInput}
             className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 text-red-400 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
           >
             <TrashIcon className="w-4 h-4"/>
             {t.clear}
           </button>
        </div>
      </div>

      {/* Main Content Area: Split View */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
         
         {/* Left: Input Editor */}
         <div className="flex-1 relative group bg-slate-900 rounded-lg border border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/50 focus-within:border-sky-500/50 transition-all min-h-[300px] lg:min-h-0">
             {/* Background Layer (Syntax Highlighting) */}
             <pre
                ref={preRef}
                aria-hidden="true"
                className="absolute inset-0 p-4 m-0 font-mono text-sm leading-6 overflow-hidden whitespace-pre bg-transparent pointer-events-none text-slate-300"
                dangerouslySetInnerHTML={{ __html: highlightJSON(jsonInput) + '<br/>' }}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
             />

             {/* Foreground Layer (Editing) */}
             <textarea
              ref={textareaRef}
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                if (error) setError(null);
              }}
              onScroll={handleScroll}
              placeholder="Paste your JSON here..."
              className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 bg-transparent text-transparent caret-white resize-none focus:outline-none whitespace-pre overflow-auto z-10 placeholder-slate-600"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
            
            {/* Error Overlay */}
            {error && (
                <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 border border-red-700 text-white px-4 py-3 rounded-md shadow-lg backdrop-blur-sm flex items-start gap-3 z-20 animate-in fade-in slide-in-from-bottom-2">
                    <div className="mt-0.5">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-sm">{t.parseError}</h4>
                        <p className="text-xs font-mono mt-1 opacity-90">{error}</p>
                    </div>
                </div>
            )}
            
            {/* Stats */}
            {!error && jsonInput && (
                 <div className="absolute bottom-2 right-4 text-xs text-slate-500 bg-slate-900/90 px-2 py-1 rounded border border-slate-800 z-20 backdrop-blur-sm shadow-sm pointer-events-none">
                    {t.length}: {jsonInput.length} {t.chars}
                 </div>
            )}
         </div>

         {/* Right: Tree View */}
         <div className="flex-1 bg-slate-900 rounded-lg border border-slate-700 overflow-auto p-4 min-h-[300px] lg:min-h-0">
            {parsedData ? (
               <div className="w-full">
                 <JsonNode value={parsedData} isLast={true} />
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  </div>
                  <div className="text-sm font-medium">{t.validJsonMsg}</div>
               </div>
            )}
         </div>

      </div>
    </div>
  );
};
