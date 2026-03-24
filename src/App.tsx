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

// pdfjs-distをCDNから読み込む
declare global {
  interface Window {
    pdfjsWorker: any;
  }
}

const pdfjsLib = (window as any).pdfjsLib;



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

  
  // ✅ ここから新しいコードを追加
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50');
    e.currentTarget.classList.remove('border-slate-200');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50');
    e.currentTarget.classList.add('border-slate-200');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50');
    e.currentTarget.classList.add('border-slate-200');
    
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files)
        .filter(file => file.type === 'application/pdf')
        .map(file => ({
          id: Math.random().toString(36).substr(2, 9),
          file
        }));
      
      if (newFiles.length > 0) {
        if (activeTool === 'merge') {
          setFiles(prev => [...prev, ...newFiles]);
        } else {
          setFiles(newFiles.slice(0, 1));
        }
        setError(null);
      } else {
        setError('PDFファイルのみアップロード可能です。');
      }
    }
  };
  // ✅ ここまで新しいコード

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
    
    console.log('ファイル名:', file.name);
    console.log('ファイルサイズ:', file.size);
    
    // ✅ pdfjs-dist を使ってPDFを読み込む
    const pdfjsLib = (window as any).pdfjsLib;
    const pdfDoc = await pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password || '',
      useSystemFonts: true
    }).promise;
    
    console.log('PDF読み込み成功。ページ数:', pdfDoc.numPages);
    
    // ✅ pdf-lib で新しいPDFを作成
    const unlockedPdf = await PDFDocument.create();
    
    // ✅ 各ページをJPEG画像に変換（PNG→JPEGで圧縮）
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      console.log(`ページ ${pageNum} を処理中...`);
      
      const page = await pdfDoc.getPage(pageNum);
      
      // キャンバスにページを描画
      const scale = 4; // 品質設定
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('キャンバスコンテキストが取得できません');
      }
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // ✅ キャンバスからJPEG画像データを取得（圧縮）
      const imageData = canvas.toDataURL('image/jpeg', 0.85); // 85%圧縮
      const imageBytes = await fetch(imageData).then(res => res.arrayBuffer());
      
      // pdf-lib に画像を埋め込み
      const image = await unlockedPdf.embedJpg(imageBytes);
      
      // 新しいページを追加
      const pdfPage = unlockedPdf.addPage([viewport.width / scale, viewport.height / scale]);
      pdfPage.drawImage(image, {
        x: 0,
        y: 0,
        width: viewport.width / scale,
        height: viewport.height / scale
      });
    }
    
    // ✅ 新しいPDFを保存
    const pdfBytes = await unlockedPdf.save();
    
    console.log('PDF保存成功。ファイルサイズ:', pdfBytes.length);
    
    downloadBlob(
      new Blob([pdfBytes], { type: 'application/pdf' }), 
      `unlocked_${file.name}`
    );
    
    setFiles([]);
    setError(null);
    console.log('ロック解除完了！');
  } catch (err: any) {
    console.error('Unlock error:', err);
    console.error('エラー詳細:', err.message);
    setError(`ロック解除に失敗しました。\nエラー: ${err.message}`);
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
  <div
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
    className={`flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group relative overflow-hidden`}
  >
    <label className="flex flex-col items-center justify-center w-full h-full pt-5 pb-6 relative z-10 cursor-pointer">
      <div className={`p-5 ${TOOL_BG_LIGHT[activeTool]} rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-500`}>
        <FileUp className={TOOL_TEXT[activeTool]} size={36} />
      </div>
      <p className="mb-2 text-base text-slate-700 font-semibold">
        ファイルをアップロード
      </p>
      <p className="text-sm text-slate-400">
        ここにPDFをドラッグ&ドロップ、またはクリック
      </p>
      <input 
        type="file" 
        className="hidden" 
        accept="application/pdf" 
        multiple={activeTool === 'merge'}
        onChange={handleFileChange}
      />
    </label>
  </div>
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
