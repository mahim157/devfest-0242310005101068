import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';

import type {
  Requirement,
  TenderData,
  DocumentMatch,
} from './utils/documentValidator';

import { computeDocumentStatus } from './utils/documentValidator';

interface UploadedFile {
  id: string;
  file: File;
  bytes: ArrayBuffer;
  name: string;
  pageCount: number;
  hash: string;
}

export default function App() {
  const [lang, setLang] = useState<'en' | 'bn'>('en');

  const [tender, setTender] = useState<TenderData | null>(null);

  const [requirements, setRequirements] = useState<Requirement[]>([]);

  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, UploadedFile>
  >({});

  const [matches, setMatches] = useState<Record<string, DocumentMatch>>({});

  const [duplicateFileIds, setDuplicateFileIds] = useState<string[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);

  const [uploadError, setUploadError] = useState<string | null>(null);

  // --------------------------------------------------
  // Hash
  // --------------------------------------------------

  const computeHash = (buffer: ArrayBuffer): string => {
    const arr = new Uint8Array(buffer.slice(0, 1024));

    let hash = 0;

    for (let i = 0; i < arr.length; i++) {
      hash = (hash << 5) - hash + arr[i];
      hash |= 0;
    }

    return hash.toString();
  };

  // --------------------------------------------------
  // JSON Upload
  // --------------------------------------------------

  const handleJsonUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(
          event.target?.result as string
        );

        if (!data.tender || !data.requirements) {
          alert('Invalid requirements.json format!');
          return;
        }

        setTender(data.tender);

        const sortedReqs = [...data.requirements].sort(
          (a: Requirement, b: Requirement) =>
            a.order - b.order
        );

        setRequirements(sortedReqs);

        const initialMatches: Record<
          string,
          DocumentMatch
        > = {};

        sortedReqs.forEach((req: Requirement) => {
          initialMatches[req.id] = {
            requirementId: req.id,
            fileId: null,
            expiryDate: null,
          };
        });

        setMatches(initialMatches);
      } catch (error) {
        console.error(error);
        alert('Failed to parse JSON file!');
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // --------------------------------------------------
  // PDF Upload
  // --------------------------------------------------

  const handlePdfUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUploadError(null);

    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const newFiles: Record<string, UploadedFile> = {
      ...uploadedFiles,
    };

    for (const file of files) {
      if (
        file.type !== 'application/pdf' &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        setUploadError(
          lang === 'en'
            ? `"${file.name}" is not a PDF file.`
            : `"${file.name}" একটি PDF ফাইল নয়।`
        );

        continue;
      }

      try {
        const bytes = await file.arrayBuffer();

        const pdfDoc = await PDFDocument.load(bytes, {
          ignoreEncryption: true,
        });

        const pageCount = pdfDoc.getPageCount();

        const hash = computeHash(bytes);

        const id = file.name;

        newFiles[id] = {
          id,
          file,
          bytes,
          name: file.name,
          pageCount,
          hash,
        };
      } catch (error) {
        console.error(error);

        setUploadError(
          lang === 'en'
            ? `"${file.name}" is corrupted or password protected.`
            : `"${file.name}" নষ্ট অথবা password protected।`
        );
      }
    }

    const hashes: Record<string, string[]> = {};

    Object.values(newFiles).forEach((file) => {
      if (!hashes[file.hash]) {
        hashes[file.hash] = [];
      }

      hashes[file.hash].push(file.id);
    });

    const duplicates: string[] = [];

    Object.values(hashes).forEach((ids) => {
      if (ids.length > 1) {
        duplicates.push(...ids);
      }
    });

    setUploadedFiles(newFiles);
    setDuplicateFileIds(duplicates);

    e.target.value = '';
  };

  // --------------------------------------------------
  // Blocking Reasons
  // --------------------------------------------------

  const getBlockingReasons = (): string[] => {
    if (!tender) {
      return ['Upload requirements.json first'];
    }

    const reasons: string[] = [];

    requirements.forEach((req) => {
      const match = matches[req.id];

      const statusInfo = computeDocumentStatus(
        req,
        match,
        tender.submission_deadline
      );

      if (statusInfo.isBlocking) {
        reasons.push(
          `${req.title_en}: ${statusInfo.status}`
        );
      }
    });

    return reasons;
  };

  const blockingReasons = getBlockingReasons();

  const isGenerateBlocked =
    blockingReasons.length > 0;

  // --------------------------------------------------
  // Stats
  // --------------------------------------------------

  const totalRequirements = requirements.length;

  const completedRequirements = requirements.filter(
    (req) => {
      const match = matches[req.id];

      if (!tender) return false;

      const statusInfo = computeDocumentStatus(
        req,
        match,
        tender.submission_deadline
      );

      return !statusInfo.isBlocking;
    }
  ).length;

  const progress =
    totalRequirements > 0
      ? Math.round(
          (completedRequirements /
            totalRequirements) *
            100
        )
      : 0;

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* ================= HEADER ================= */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl text-white shadow-sm">
              📋
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                TenderBuilder
              </h1>

              <p className="text-xs text-slate-500">
                Tender document management
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              setLang(
                lang === 'en'
                  ? 'bn'
                  : 'en'
              )
            }
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {lang === 'en'
              ? 'বাংলা'
              : 'English'}
          </button>

        </div>

      </header>

      {/* ================= MAIN ================= */}

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* Hero */}

        <div className="mb-8">

          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">
            Tender Workspace
          </p>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            {lang === 'en'
              ? 'Prepare your tender package'
              : 'আপনার Tender Package প্রস্তুত করুন'}
          </h2>

          <p className="mt-2 max-w-2xl text-slate-500">
            {lang === 'en'
              ? 'Upload your requirements and supporting documents, validate them, and prepare your final tender package.'
              : 'Requirements এবং supporting documents upload করে যাচাই করুন এবং final tender package প্রস্তুত করুন।'}
          </p>

        </div>

        {/* ================= STATS ================= */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Tender ID
            </p>

            <p className="mt-2 truncate text-lg font-bold">
              {tender?.tender_id || 'Not uploaded'}
            </p>

          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Requirements
            </p>

            <p className="mt-2 text-2xl font-bold">
              {totalRequirements}
            </p>

          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Documents
            </p>

            <p className="mt-2 text-2xl font-bold">
              {Object.keys(uploadedFiles).length}
            </p>

          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Completion
            </p>

            <div className="mt-2 flex items-center gap-3">

              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">

                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${progress}%`,
                  }}
                />

              </div>

              <span className="text-sm font-bold">
                {progress}%
              </span>

            </div>

          </div>

        </div>

        {/* ================= TENDER INFO ================= */}

        {tender && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 px-6 py-5">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  📑
                </div>

                <div>
                  <h3 className="font-bold">
                    Tender Information
                  </h3>

                  <p className="text-sm text-slate-500">
                    Basic tender details
                  </p>
                </div>

              </div>

            </div>

            <div className="grid gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Tender ID
                </p>

                <p className="mt-1 font-semibold">
                  {tender.tender_id}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Bidder
                </p>

                <p className="mt-1 font-semibold">
                  {tender.bidder}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Deadline
                </p>

                <p className="mt-1 font-semibold text-red-600">
                  {tender.submission_deadline}
                </p>
              </div>

              <div className="md:col-span-2 lg:col-span-3">

                <p className="text-xs font-medium uppercase text-slate-400">
                  Tender Title
                </p>

                <p className="mt-1 font-semibold">
                  {tender.title}
                </p>

              </div>

              <div className="md:col-span-2 lg:col-span-3">

                <p className="text-xs font-medium uppercase text-slate-400">
                  Procuring Entity
                </p>

                <p className="mt-1 font-semibold">
                  {tender.procuring_entity}
                </p>

              </div>

            </div>

          </section>
        )}

        {/* ================= UPLOAD GRID ================= */}

        <div className="mb-8 grid gap-6 lg:grid-cols-2">

          {/* JSON */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="mb-5 flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg">
                📋
              </div>

              <div>
                <h3 className="font-bold">
                  Requirements JSON
                </h3>

                <p className="text-sm text-slate-500">
                  Upload tender requirements
                </p>
              </div>

            </div>

            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50">

              <div className="mb-3 text-4xl">
                📄
              </div>

              <p className="font-semibold">
                Choose JSON file
              </p>

              <p className="mt-1 text-xs text-slate-500">
                requirements.json
              </p>

              <span className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Browse File
              </span>

              <input
                type="file"
                accept=".json,application/json"
                onChange={handleJsonUpload}
                className="hidden"
              />

            </label>

          </section>

          {/* PDF */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="mb-5 flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-lg">
                📁
              </div>

              <div>
                <h3 className="font-bold">
                  Supporting Documents
                </h3>

                <p className="text-sm text-slate-500">
                  Upload required PDF documents
                </p>
              </div>

            </div>

            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-red-400 hover:bg-red-50">

              <div className="mb-3 text-4xl">
                📎
              </div>

              <p className="font-semibold">
                Choose PDF files
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Multiple files supported
              </p>

              <span className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Browse Files
              </span>

              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handlePdfUpload}
                className="hidden"
              />

            </label>

          </section>

        </div>

        {/* ================= ERROR ================= */}

        {uploadError && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

            <span className="text-xl">
              ⚠️
            </span>

            <div>
              <p className="font-semibold">
                Upload Error
              </p>

              <p className="mt-1 text-sm">
                {uploadError}
              </p>
            </div>

          </div>
        )}

        {/* ================= FILES ================= */}

        {Object.keys(uploadedFiles).length > 0 && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 px-6 py-5">

              <h3 className="font-bold">
                Uploaded Documents
              </h3>

              <p className="text-sm text-slate-500">
                {Object.keys(uploadedFiles).length} document(s)
              </p>

            </div>

            <div className="divide-y divide-slate-100">

              {Object.values(uploadedFiles).map(
                (file) => {

                  const isDuplicate =
                    duplicateFileIds.includes(
                      file.id
                    );

                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                    >

                      <div className="flex min-w-0 items-center gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-xl">
                          📄
                        </div>

                        <div className="min-w-0">

                          <p className="truncate font-semibold">
                            {file.name}
                          </p>

                          <p className="text-sm text-slate-500">
                            {file.pageCount}{' '}
                            {file.pageCount === 1
                              ? 'page'
                              : 'pages'}
                          </p>

                        </div>

                      </div>

                      {isDuplicate ? (
                        <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          Duplicate
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          Uploaded
                        </span>
                      )}

                    </div>
                  );
                }
              )}

            </div>

          </section>
        )}

        {/* ================= REQUIREMENTS ================= */}

        {requirements.length > 0 && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h3 className="font-bold">
                  Tender Requirements
                </h3>

                <p className="text-sm text-slate-500">
                  Review document requirements
                </p>

              </div>

              <div className="text-right">

                <p className="text-2xl font-bold">
                  {completedRequirements}
                  <span className="text-base font-normal text-slate-400">
                    /{totalRequirements}
                  </span>
                </p>

                <p className="text-xs text-slate-500">
                  Completed
                </p>

              </div>

            </div>

            <div className="divide-y divide-slate-100">

              {requirements.map((req) => {

                const match = matches[req.id];

                const statusInfo = tender
                  ? computeDocumentStatus(
                      req,
                      match,
                      tender.submission_deadline
                    )
                  : {
                      isBlocking: true,
                      status: 'Missing',
                    };

                return (
                  <div
                    key={req.id}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >

                    <div className="flex items-start gap-4">

                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          statusInfo.isBlocking
                            ? 'bg-red-100 text-red-600'
                            : 'bg-green-100 text-green-600'
                        }`}
                      >
                        {statusInfo.isBlocking
                          ? '!'
                          : '✓'}
                      </div>

                      <div>

                        <p className="font-semibold text-slate-800">
                          {req.title_en}
                        </p>

                        {'title_bn' in req &&
                          req.title_bn && (
                            <p className="mt-1 text-sm text-slate-500">
                              {req.title_bn}
                            </p>
                          )}

                        <div className="mt-2 flex flex-wrap gap-2">

                          {req.mandatory && (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                              Mandatory
                            </span>
                          )}

                          {req.has_expiry && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Expiry required
                            </span>
                          )}

                        </div>

                      </div>

                    </div>

                    <span
                      className={`self-start rounded-full px-3 py-1.5 text-xs font-bold sm:self-auto ${
                        statusInfo.isBlocking
                          ? 'bg-red-50 text-red-700'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {statusInfo.status}
                    </span>

                  </div>
                );
              })}

            </div>

          </section>
        )}

        {/* ================= BLOCKING ================= */}

        {blockingReasons.length > 0 && (
          <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">

            <div className="flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">
                ⚠️
              </div>

              <div>

                <h3 className="font-bold text-amber-900">
                  {lang === 'en'
                    ? 'Action Required'
                    : 'Action Required'}
                </h3>

                <p className="mt-1 text-sm text-amber-800">
                  {lang === 'en'
                    ? 'Some requirements must be completed before generating the tender package.'
                    : 'Tender package generate করার আগে কিছু requirement সম্পূর্ণ করতে হবে।'}
                </p>

                <ul className="mt-3 space-y-1 text-sm text-amber-800">

                  {blockingReasons.map(
                    (reason, index) => (
                      <li
                        key={index}
                        className="flex gap-2"
                      >
                        <span>•</span>
                        <span>{reason}</span>
                      </li>
                    )
                  )}

                </ul>

              </div>

            </div>

          </section>
        )}

        {/* ================= GENERATE ================= */}

        <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-lg">

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-sm font-semibold text-blue-300">
                FINAL STEP
              </p>

              <h3 className="mt-1 text-xl font-bold">
                Generate Tender Package
              </h3>

              <p className="mt-1 max-w-xl text-sm text-slate-400">
                Review all requirements and documents before generating the final package.
              </p>

            </div>

            <button
              type="button"
              disabled={
                isGenerateBlocked ||
                isGenerating
              }
              onClick={async () => {

                if (isGenerateBlocked) return;

                try {

                  setIsGenerating(true);

                  console.log(
                    'Generating tender package...'
                  );

                  alert(
                    lang === 'en'
                      ? 'Tender package generation started.'
                      : 'Tender package generation শুরু হয়েছে।'
                  );

                } catch (error) {

                  console.error(error);

                  alert(
                    lang === 'en'
                      ? 'Failed to generate tender package.'
                      : 'Tender package generate করা যায়নি।'
                  );

                } finally {

                  setIsGenerating(false);

                }
              }}
              className={`rounded-xl px-6 py-3 font-bold transition ${
                isGenerateBlocked ||
                isGenerating
                  ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                  : 'bg-white text-slate-900 shadow-sm hover:bg-slate-100'
              }`}
            >
              {isGenerating
                ? 'Generating...'
                : 'Generate Package →'}
            </button>

          </div>

        </section>

        {/* ================= FOOTER ================= */}

        <footer className="py-8 text-center text-sm text-slate-400">
          TenderBuilder • Document validation & package preparation
        </footer>

      </main>

    </div>
  );
}