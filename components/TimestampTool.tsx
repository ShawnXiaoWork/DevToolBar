import React, { useState, useEffect } from 'react';
import { ArrowRightLeftIcon, CopyIcon, CheckIcon } from './Icons';
import { Language } from '../types';
import { translations } from '../i18n';

interface TimestampToolProps {
  lang: Language;
}

export const TimestampTool: React.FC<TimestampToolProps> = ({ lang }) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isPaused, setIsPaused] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Converter State
  const [inputVal, setInputVal] = useState<string>('');
  const [inputType, setInputType] = useState<'timestamp' | 'date'>('timestamp');
  const [unit, setUnit] = useState<'s' | 'ms'>('s');
  const [result, setResult] = useState<string>('');

  const t = translations[lang].timestamp;
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => setCurrentDate(new Date()), 100);
    return () => clearInterval(timer);
  }, [isPaused]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConvert = () => {
    if (!inputVal.trim()) {
      setResult('');
      return;
    }

    try {
      if (inputType === 'timestamp') {
        let ts = parseInt(inputVal, 10);
        if (isNaN(ts)) throw new Error('Invalid number');
        
        // Auto-detect or use unit preference? 
        // Strict adherence to unit selector for explicit control
        if (unit === 's') ts *= 1000;
        
        const date = new Date(ts);
        if (isNaN(date.getTime())) throw new Error('Invalid Date');
        setResult(date.toLocaleString(locale) + ` (ISO: ${date.toISOString()})`);
      } else {
        const date = new Date(inputVal);
        if (isNaN(date.getTime())) throw new Error('Invalid Format');
        
        let ts = date.getTime();
        if (unit === 's') ts = Math.floor(ts / 1000);
        setResult(ts.toString());
      }
    } catch (e) {
      setResult(t.invalidInput);
    }
  };

  // Auto convert on change
  useEffect(() => {
    handleConvert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputVal, inputType, unit, lang]);

  const nowTsMs = currentDate.getTime();
  const nowTsS = Math.floor(nowTsMs / 1000);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Current Time Dashboard */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-sky-400 flex items-center gap-2">
            {t.currentTime}
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className={`text-xs px-2 py-0.5 rounded-full border ${isPaused ? 'border-yellow-500 text-yellow-500' : 'border-green-500 text-green-500'} hover:bg-slate-700 transition-colors`}
            >
              {isPaused ? t.paused : t.live}
            </button>
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 relative group">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{t.unixSec}</span>
            <div className="text-2xl font-mono text-white mt-1">{nowTsS}</div>
            <button 
              onClick={() => copyToClipboard(nowTsS.toString(), 'nowS')}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              {copiedField === 'nowS' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
            </button>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 relative group">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{t.unixMs}</span>
            <div className="text-2xl font-mono text-white mt-1">{nowTsMs}</div>
            <button 
              onClick={() => copyToClipboard(nowTsMs.toString(), 'nowMs')}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              {copiedField === 'nowMs' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
            </button>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 relative group">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{t.formatted}</span>
            <div className="text-sm font-mono text-white mt-2 leading-relaxed">
              {currentDate.toLocaleString(locale)}
            </div>
             <button 
              onClick={() => copyToClipboard(currentDate.toLocaleString(locale), 'nowDate')}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              {copiedField === 'nowDate' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Converter Section */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-6">{t.converter}</h2>
        
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          
          {/* Input Side */}
          <div className="flex-1 space-y-3">
             <div className="flex gap-2 mb-2">
                <button 
                  onClick={() => { setInputType('timestamp'); setInputVal(''); }}
                  className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${inputType === 'timestamp' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                  {t.timestampInput}
                </button>
                <button 
                  onClick={() => { setInputType('date'); setInputVal(''); }}
                  className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${inputType === 'date' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                  {t.dateInput}
                </button>
             </div>

             <div className="relative">
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder={inputType === 'timestamp' ? t.placeholderTimestamp : t.placeholderDate}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
             </div>
             
             <div className="flex gap-4 items-center">
                <span className="text-sm text-slate-400">{t.unit}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="unit" checked={unit === 's'} onChange={() => setUnit('s')} className="text-sky-500 focus:ring-sky-500 bg-slate-700 border-slate-600" />
                  <span className="text-sm text-slate-300">{t.seconds}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="unit" checked={unit === 'ms'} onChange={() => setUnit('ms')} className="text-sky-500 focus:ring-sky-500 bg-slate-700 border-slate-600" />
                  <span className="text-sm text-slate-300">{t.milliseconds}</span>
                </label>
             </div>
          </div>

          {/* Divider / Arrow */}
          <div className="flex items-center justify-center text-slate-500">
            <ArrowRightLeftIcon className="w-6 h-6 rotate-90 md:rotate-0" />
          </div>

          {/* Output Side */}
          <div className="flex-1 space-y-3">
             <div className="bg-slate-900/80 rounded-lg border border-slate-600 h-full p-4 flex flex-col justify-between min-h-[140px]">
                <div>
                   <span className="text-xs text-slate-500 uppercase font-bold block mb-2">{t.result}</span>
                   <div className="text-white font-mono break-all whitespace-pre-wrap">
                      {result || <span className="text-slate-600 italic">{t.waiting}</span>}
                   </div>
                </div>
                
                {result && result !== t.invalidInput && (
                  <div className="flex justify-end mt-4">
                     <button 
                        onClick={() => copyToClipboard(result, 'result')}
                        className="flex items-center gap-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-3 py-1.5 rounded-md transition-all"
                      >
                        {copiedField === 'result' ? <CheckIcon className="w-3 h-3 text-green-500" /> : <CopyIcon className="w-3 h-3" />}
                        {copiedField === 'result' ? t.copied : t.copy}
                     </button>
                  </div>
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
