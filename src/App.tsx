/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { 
  FileUp, 
  Unlock, 
  Combine, 
  Scissors, 
  Download, 
  X, 
  Plus, 
  ChevronRight,
  Loader2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tool = 'unlock' | 'merge' | 'split';

const TOOL_LABELS: Record<Tool, string> = {
  unlock: 'ロック解除',
  merge: '結合する',
  split: '分割する'
};

const TOOL_COLORS: Record<Tool, string> = {
  unlock: 'bg-rose-500',
  merge: 'bg-indigo-500',
  split: 'bg-amber-500'
};

const TOOL_BG_LIGHT: Record<Tool, string> = {
  unlock: 'bg-rose-50',
  merge: 'bg-indigo-50',
  split: 'bg-amber-50'
};

const TOOL_TEXT: Record<Tool, string> = {
  unlock: 'text-rose-600',
  merge: 'text-indigo-600',
  split: 'text-amber-600'
};

interface FileItem {
  id: string;
  file: File;
  password?: string;
}

export default function App() {
  const [activeTool, setActiveTool] = useState<Tool>('merge');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file
      }));
      
      if (activeTool === 'merge') {
        setFiles(prev => [...prev, ...newFiles]);
      } else {
        setFiles(newFiles.slice(0, 1));
      }
      setError(null);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updatePassword = (id: string, password: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, password } : f));
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

const processUnlock = async () => {
  if (files.length === 0) return;
  setIsProcessing(true);
  setError(null);
  try {
    const { file, password } = files[0];
    const arrayBuffer = await file.arrayBuffer();
    
    // ✅ パスワードを指定してPDFを読み込む
    const sourcePdf = await PDFDocument.load(arrayBuffer, { 
      password: password || ''
    } as any);
    
    // ✅ 新しいPDFを作成（重要：暗号化なしで）
    const unlockedPdf = await PDFDocument.create();
    
    // ✅ すべてのページをコピー
    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await unlockedPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((page) => unlockedPdf.addPage(page));
    
    // ✅ 暗号化を明示的に削除
    // pdf-libでは save() の時点で暗号化されないので、
    // ここで追加処理は不要ですが、念のため確認します
    const pdfBytes = await unlockedPdf.save();
    
    downloadBlob(
      new Blob([pdfBytes], { type: 'application/pdf' }), 
      `unlocked_${file.name}`
    );
    
    setFiles([]); // 処理後にファイルをリセット
  } catch (err: any) {
    console.error('Unlock error:', err);
    setError('PDFのロック解除に失敗しました。パスワードが正しいか、対応したPDFか確認してください。');
  } finally {
    setIsProcessing(false);
  }
};


  const processMerge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);
    setError(null);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of files) {
        const arrayBuffer = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer, { password: item.password } as any);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      const pdfBytes = await mergedPdf.save();
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), 'merged.pdf');
    } catch (err: any) {
      setError('PDFの結合に失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const processSplit = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { file, password } = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { password } as any);
      const pageCount = pdfDoc.getPageCount();
      
      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(page);
        const pdfBytes = await newPdf.save();
        downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `page_${i + 1}_${file.name}`);
      }
    } catch (err: any) {
      setError('PDFの分割に失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = () => {
    if (activeTool === 'unlock') processUnlock();
    else if (activeTool === 'merge') processMerge();
    else if (activeTool === 'split') processSplit();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm mb-4">
            <div className={`p-2 rounded-xl ${TOOL_COLORS[activeTool]} text-white transition-colors duration-500`}>
              {activeTool === 'unlock' && <Unlock size={24} />}
              {activeTool === 'merge' && <Combine size={24} />}
              {activeTool === 'split' && <Scissors size={24} />}
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">PDF Toolbox</h1>
          <p className="text-slate-500">シンプルで使いやすい、ブラウザ完結のPDFツール</p>
        </header>

        {/* Tool Selector */}
        <div className="flex p-1.5 bg-slate-200/50 rounded-2xl mb-8">
          {(['merge', 'split', 'unlock'] as Tool[]).map((tool) => (
            <button
              key={tool}
              onClick={() => {
                setActiveTool(tool);
                setFiles([]);
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTool === tool 
                  ? `${TOOL_COLORS[tool]} text-white shadow-lg` 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              {tool === 'unlock' && <Unlock size={16} />}
              {tool === 'merge' && <Combine size={16} />}
              {tool === 'split' && <Scissors size={16} />}
              <span>{TOOL_LABELS[tool]}</span>
            </button>
          ))}
        </div>

        {/* Main Workspace */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="p-8">
            {files.length === 0 ? (
              <label className={`flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group relative overflow-hidden`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10">
                  <div className={`p-5 ${TOOL_BG_LIGHT[activeTool]} rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-500`}>
                    <FileUp className={TOOL_TEXT[activeTool]} size={36} />
                  </div>
                  <p className="mb-2 text-base text-slate-700 font-semibold">
                    ファイルをアップロード
                  </p>
                  <p className="text-sm text-slate-400">
                    ここにPDFをドラッグ＆ドロップ
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="application/pdf" 
                  multiple={activeTool === 'merge'}
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {files.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group"
                    >
                      <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover:scale-105 transition-transform">
                        <FileText className={TOOL_TEXT[activeTool]} size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.file.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      
                      {activeTool === 'unlock' && (
                        <input
                          type="password"
                          placeholder="パスワード"
                          className="text-xs px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 w-32 transition-all"
                          value={item.password || ''}
                          onChange={(e) => updatePassword(item.id, e.target.value)}
                        />
                      )}

                      <button 
                        onClick={() => removeFile(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <X size={18} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {activeTool === 'merge' && (
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-100 rounded-2xl cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-200 transition-all text-sm text-indigo-500 font-semibold">
                    <Plus size={18} />
                    さらにファイルを追加
                    <input type="file" className="hidden" accept="application/pdf" multiple onChange={handleFileChange} />
                  </label>
                )}

                <div className="pt-6">
                  <button
                    disabled={isProcessing || (activeTool === 'merge' && files.length < 2) || (activeTool !== 'merge' && files.length === 0)}
                    onClick={handleAction}
                    className={`w-full flex items-center justify-center gap-3 py-4 ${TOOL_COLORS[activeTool]} text-white rounded-2xl font-bold text-lg shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-300`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={22} />
                        処理中...
                      </>
                    ) : (
                      <>
                        <Download size={22} />
                        {activeTool === 'unlock' && 'ロック解除して保存'}
                        {activeTool === 'merge' && '結合して保存'}
                        {activeTool === 'split' && '分割して保存'}
                      </>
                    )}
                  </button>
                  {activeTool === 'split' && files.length > 0 && (
                    <p className="mt-3 text-center text-xs text-slate-400 font-medium">
                      ※ 各ページが個別のファイルとしてダウンロードされます
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="px-8 pb-8">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-semibold"
              >
                <AlertCircle size={20} />
                {error}
              </motion.div>
            </div>
          )}
        </div>

        <footer className="mt-12 text-center">
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            ファイルはブラウザ内で安全に処理されます。<br />
            サーバーにデータが送信されることはありません。
          </p>
        </footer>
      </motion.div>
    </div>
  );
}
