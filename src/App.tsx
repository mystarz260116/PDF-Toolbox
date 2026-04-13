/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib-with-encrypt';
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
  FileText,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// pdfjs-distをCDNから読み込む
declare global {
  interface Window {
    pdfjsWorker: any;
  }
}

const pdfjsLib = (window as any).pdfjsLib;

type Tool = 'unlock' | 'merge' | 'split' | 'compress' | 'protect';

const TOOL_LABELS: Record<Tool, string> = {
  unlock: 'ロック解除',
  merge: '結合する',
  split: '分割する',
  compress: '圧縮する',
  protect: 'パスワード付与'
};

const TOOL_COLORS: Record<Tool, string> = {
  unlock: 'bg-rose-500',
  merge: 'bg-indigo-500',
  split: 'bg-amber-500',
  compress: 'bg-cyan-500',
  protect: 'bg-purple-500'
};

const TOOL_BG_LIGHT: Record<Tool, string> = {
  unlock: 'bg-rose-50',
  merge: 'bg-indigo-50',
  split: 'bg-amber-50',
  compress: 'bg-cyan-50',
  protect: 'bg-purple-50'
};

const TOOL_TEXT: Record<Tool, string> = {
  unlock: 'text-rose-600',
  merge: 'text-indigo-600',
  split: 'text-amber-600',
  compress: 'text-cyan-600',
  protect: 'text-purple-600'
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
  const [compressLevel, setCompressLevel] = useState<'light' | 'standard' | 'maximum'>('standard');
  const [protectPassword, setProtectPassword] = useState<string>('');
  const [protectPasswordConfirm, setProtectPasswordConfirm] = useState<string>('');

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
      const newFiles = (Array.from(e.dataTransfer.files) as File[])
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
      
      const pdfjsLib = (window as any).pdfjsLib;
      const pdfDoc = await pdfjsLib.getDocument({
        data: arrayBuffer,
        password: password || '',
        useSystemFonts: true,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      }).promise;

      console.log('PDF読み込み成功。ページ数:', pdfDoc.numPages);

      const unlockedPdf = await PDFDocument.create();
      
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        console.log(`ページ ${pageNum} を処理中...`);
        
        const page = await pdfDoc.getPage(pageNum);
        const scale = 4;
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
        
        const imageData = canvas.toDataURL('image/jpeg', 0.85);
        const imageBytes = await fetch(imageData).then(res => res.arrayBuffer());
        
        const image = await unlockedPdf.embedJpg(imageBytes);
        const pdfPage = unlockedPdf.addPage([viewport.width / scale, viewport.height / scale]);
        pdfPage.drawImage(image, {
          x: 0,
          y: 0,
          width: viewport.width / scale,
          height: viewport.height / scale
        });
      }
      
      const pdfBytes = await unlockedPdf.save();
      
      console.log('PDF保存成功。ファイルサイズ:', pdfBytes.length);
      
      downloadBlob(
        new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }), 
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
      const pdfjsLib = (window as any).pdfjsLib;

      for (const item of files) {
        console.log('結合中:', item.file.name);
        const arrayBuffer = await item.file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({
          data: arrayBuffer,
          password: item.password || '',
          useSystemFonts: true,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        }).promise;

        console.log(`  ページ数: ${pdfDoc.numPages}`);

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const scale = 2;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const context = canvas.getContext('2d');
          if (!context) throw new Error('キャンバスコンテキストが取得できません');

          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({ canvasContext: context, viewport }).promise;

          const imageData = canvas.toDataURL('image/jpeg', 0.92);
          const imageBytes = await fetch(imageData).then(res => res.arrayBuffer());

          const image = await mergedPdf.embedJpg(imageBytes);
          const pdfPage = mergedPdf.addPage([viewport.width / scale, viewport.height / scale]);
          pdfPage.drawImage(image, {
            x: 0,
            y: 0,
            width: viewport.width / scale,
            height: viewport.height / scale
          });
        }
      }

      const pdfBytes = await mergedPdf.save();
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), 'merged.pdf');
      setFiles([]);
      setError(null);
      console.log('結合完了！');
    } catch (err: any) {
      console.error('Merge error:', err);
      setError(`PDFの結合に失敗しました。\nエラー: ${err.message}`);
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
        downloadBlob(new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }), `page_${i + 1}_${file.name}`);
      }
    } catch (err: any) {
      setError('PDFの分割に失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const processCompress = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { file, password } = files[0];
      const arrayBuffer = await file.arrayBuffer();
      
      console.log('ファイル名:', file.name);
      console.log('圧縮レベル:', compressLevel);
      console.log('元のファイルサイズ:', file.size);
      
      const pdfjsLib = (window as any).pdfjsLib;
      const pdfDoc = await pdfjsLib.getDocument({
        data: arrayBuffer,
        password: password || '',
        useSystemFonts: true,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      }).promise;

      console.log('PDF読み込み成功。ページ数:', pdfDoc.numPages);

      const compressedPdf = await PDFDocument.create();
      
      let scale = 2;
      let jpegQuality = 0.85;
      
      if (compressLevel === 'light') {
        scale = 1;
        jpegQuality = 0.60;
      } else if (compressLevel === 'standard') {
        scale = 1.5;
        jpegQuality = 0.75;
      } else if (compressLevel === 'maximum') {
        scale = 2;
        jpegQuality = 0.90;
      }
      
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        console.log(`ページ ${pageNum} を圧縮中... (${compressLevel})`);
        
        const page = await pdfDoc.getPage(pageNum);
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
        
        const imageData = canvas.toDataURL('image/jpeg', jpegQuality);
        const imageBytes = await fetch(imageData).then(res => res.arrayBuffer());
        
        const image = await compressedPdf.embedJpg(imageBytes);
        const pdfPage = compressedPdf.addPage([viewport.width / scale, viewport.height / scale]);
        pdfPage.drawImage(image, {
          x: 0,
          y: 0,
          width: viewport.width / scale,
          height: viewport.height / scale
        });
      }
      
      const pdfBytes = await compressedPdf.save();
      
      const originalSize = file.size;
      const compressedSize = pdfBytes.length;
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      
      console.log('圧縮完了！');
      console.log('元のサイズ:', (originalSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('圧縮後:', (compressedSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('圧縮率:', ratio, '%');
      
      downloadBlob(
        new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }), 
        `compressed_${file.name}`
      );
      
      setFiles([]);
      setError(null);
    } catch (err: any) {
      console.error('Compress error:', err);
      console.error('エラー詳細:', err.message);
      setError(`PDFの圧縮に失敗しました。\nエラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const processProtect = async () => {
    if (files.length === 0) return;
    if (!protectPassword) {
      setError('パスワードを入力してください。');
      return;
    }
    if (protectPassword !== protectPasswordConfirm) {
      setError('パスワードが一致しません。');
      return;
    }
    if (protectPassword.length < 4) {
      setError('パスワードは4文字以上で設定してください。');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const { file } = files[0];
      const arrayBuffer = await file.arrayBuffer();

      console.log('ファイル名:', file.name);
      console.log('パスワード付与中...');

      // pdfjsLibで各ページをcanvasに描画してJPEGとして埋め込む
      // （pdf-lib-with-encryptのencrypt()はlazy loadingと相性が悪くコンテンツが空になるため）
      const pdfjsLib = (window as any).pdfjsLib;
      const srcDoc = await pdfjsLib.getDocument({
        data: arrayBuffer,
        password: '',
        useSystemFonts: true,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      }).promise;

      console.log('PDF読み込み成功。ページ数:', srcDoc.numPages);

      const newPdf = await PDFDocument.create();

      for (let pageNum = 1; pageNum <= srcDoc.numPages; pageNum++) {
        console.log(`ページ ${pageNum} を処理中...`);

        const page = await srcDoc.getPage(pageNum);
        const scale = 2;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        if (!context) throw new Error('キャンバスコンテキストが取得できません');

        // 白背景を塗ってからレンダリング（背景が透明のままJPEG変換すると黒になり文字が消えるため）
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: context, viewport }).promise;

        const imageData = canvas.toDataURL('image/jpeg', 0.92);
        const imageBytes = await fetch(imageData).then(res => res.arrayBuffer());

        const image = await newPdf.embedJpg(imageBytes);
        const pdfPage = newPdf.addPage([viewport.width / scale, viewport.height / scale]);
        pdfPage.drawImage(image, {
          x: 0,
          y: 0,
          width: viewport.width / scale,
          height: viewport.height / scale
        });
      }

      // パスワード保護を設定
      await newPdf.encrypt({
        userPassword: protectPassword,
        ownerPassword: protectPassword,
        permissions: {
          printing: 'highResolution',
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          documentAssembly: false
        }
      });

      // 暗号化PDFはuseObjectStreams: falseが必須（trueだと多くのリーダーで破損扱いになる）
      const pdfBytes = await newPdf.save({ useObjectStreams: false });

      console.log('パスワード付与完了！ファイルサイズ:', pdfBytes.length);

      downloadBlob(
        new Blob([pdfBytes], { type: 'application/pdf' }),
        `protected_${file.name}`
      );

      setFiles([]);
      setProtectPassword('');
      setProtectPasswordConfirm('');
      setError(null);
      console.log('パスワード付与完了！');
    } catch (err: any) {
      console.error('Protect error:', err);
      console.error('エラー詳細:', err.message);
      setError(`パスワード付与に失敗しました。\nエラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = () => {
    if (activeTool === 'unlock') processUnlock();
    else if (activeTool === 'merge') processMerge();
    else if (activeTool === 'split') processSplit();
    else if (activeTool === 'compress') processCompress();
    else if (activeTool === 'protect') processProtect();
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
              {activeTool === 'compress' && <FileUp size={24} />}
              {activeTool === 'protect' && <Lock size={24} />}
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">PDF Toolbox</h1>
          <p className="text-slate-500">シンプルで使いやすい、ブラウザ完結のPDFツール</p>
        </header>

        {/* Tool Selector */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-200/50 rounded-2xl mb-8">
          {(['merge', 'split', 'compress', 'protect', 'unlock'] as Tool[]).map((tool) => (
            <button
              key={tool}
              onClick={() => {
                setActiveTool(tool);
                setFiles([]);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTool === tool 
                  ? `${TOOL_COLORS[tool]} text-white shadow-lg` 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              {tool === 'unlock' && <Unlock size={16} />}
              {tool === 'merge' && <Combine size={16} />}
              {tool === 'split' && <Scissors size={16} />}
              {tool === 'compress' && <FileUp size={16} />}
              {tool === 'protect' && <Lock size={16} />}
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
                      
                      {(activeTool === 'unlock' || activeTool === 'merge') && (
                        <input
                          type="password"
                          placeholder="パスワード（任意）"
                          className={`text-xs px-4 py-2 bg-white border rounded-xl focus:outline-none w-32 transition-all ${
                            activeTool === 'unlock'
                              ? 'border-slate-200 focus:ring-2 focus:ring-rose-200'
                              : 'border-slate-200 focus:ring-2 focus:ring-indigo-200'
                          }`}
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

                {activeTool === 'compress' && files.length > 0 && (
                  <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-100">
                    <p className="text-sm font-semibold text-cyan-900 mb-3">圧縮レベルを選択</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCompressLevel('light')}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
                          compressLevel === 'light'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white text-cyan-600 border border-cyan-200 hover:bg-cyan-100'
                        }`}
                      >
                        軽量
                        <br />
                        <span className="text-xs font-normal">最小サイズ</span>
                      </button>
                      <button
                        onClick={() => setCompressLevel('standard')}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
                          compressLevel === 'standard'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white text-cyan-600 border border-cyan-200 hover:bg-cyan-100'
                        }`}
                      >
                        標準
                        <br />
                        <span className="text-xs font-normal">バランス</span>
                      </button>
                      <button
                        onClick={() => setCompressLevel('maximum')}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
                          compressLevel === 'maximum'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white text-cyan-600 border border-cyan-200 hover:bg-cyan-100'
                        }`}
                      >
                        最大
                        <br />
                        <span className="text-xs font-normal">品質優先</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTool === 'protect' && files.length > 0 && (
                  <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                    <p className="text-sm font-semibold text-purple-900 mb-3">パスワードを設定</p>
                    <div className="space-y-3">
                      <input
                        type="password"
                        placeholder="パスワード（4文字以上）"
                        className="w-full px-4 py-2 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 text-sm transition-all"
                        value={protectPassword}
                        onChange={(e) => setProtectPassword(e.target.value)}
                      />
                      <input
                        type="password"
                        placeholder="パスワード（確認）"
                        className="w-full px-4 py-2 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 text-sm transition-all"
                        value={protectPasswordConfirm}
                        onChange={(e) => setProtectPasswordConfirm(e.target.value)}
                      />
                      {protectPassword && protectPasswordConfirm && protectPassword !== protectPasswordConfirm && (
                        <p className="text-xs text-red-600 font-semibold">パスワードが一致しません</p>
                      )}
                      {protectPassword && protectPassword.length < 4 && (
                        <p className="text-xs text-amber-600 font-semibold">4文字以上で設定してください</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTool === 'merge' && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-100 rounded-2xl cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-200 transition-all text-sm text-indigo-500 font-semibold"
                  >
                    <label className="flex items-center justify-center gap-2 w-full cursor-pointer">
                      <Plus size={18} />
                      さらにファイルを追加
                      <input type="file" className="hidden" accept="application/pdf" multiple onChange={handleFileChange} />
                    </label>
                  </div>
                )}

                <div className="pt-6">
                  <button
                    disabled={isProcessing || (activeTool === 'merge' && files.length < 2) || (activeTool !== 'merge' && files.length === 0) || (activeTool === 'protect' && (!protectPassword || protectPassword !== protectPasswordConfirm || protectPassword.length < 4))}
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
                        {activeTool === 'compress' && '圧縮して保存'}
                        {activeTool === 'protect' && 'パスワード付与して保存'}
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
