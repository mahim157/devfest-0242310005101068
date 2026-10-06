import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import type {
  Requirement,
  TenderData,
  DocumentMatch,
} from './utils/documentValidator';
import { computeDocumentStatus } from './utils/documentValidator';
import { generateTenderPackage } from './utils/pdfGenerator';

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

  const computeHash = (buffer: ArrayBuffer): string => {
    const arr = new Uint8Array(buffer.slice(0, 1024));

    let hash = 0;

    for (let i = 0; i < arr.length; i++) {
      hash = (hash << 5) - hash + arr[i];
      hash |= 0;
    }

    return hash.toString();
  };

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
        setRequirements(data.requirements);

        const initialMatches: Record<
          string,
          DocumentMatch
        > = {};

        data.requirements.forEach(
          (req: Requirement) => {
            initialMatches[req.id] = {
              requirementId: req.id,
              fileId: null,
              expiryDate: null,
            };
          }
        );

        setMatches(initialMatches);
      } catch (err) {
        console.error(err);
        alert('Failed to parse JSON file!');
      }
    };

    reader.readAsText(file);
  };

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
            ? `File "${file.name}" is not a PDF!`
            : `ফাইল "${file.name}" একটি পিডিএফ নয়!`
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
      } catch (err) {
        console.error(err);

        setUploadError(
          lang === 'en'
            ? `File "${file.name}" is corrupted or password protected!`
            : `ফাইল "${file.name}" পাসওয়ার্ড সুরক্ষিত বা ক্ষতিগ্রস্ত!`
        );
      }
    }

    // Find duplicate files
    const hashes: Record<string, string[]> = {};

    Object.values(newFiles).forEach((f) => {
      if (!hashes[f.hash]) {
        hashes[f.hash] = [];
      }

      hashes[f.hash].push(f.id);
    });

    const duplicates: string[] = [];

    Object.values(hashes).forEach((ids) => {
      if (ids.length > 1) {
        duplicates.push(...ids);
      }
    });

    // Update state
    setUploadedFiles(newFiles);
    setDuplicateFileIds(duplicates);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold">
          Tender Document Manager
        </h1>

        {/* Language */}
        <div className="mb-6">
          <button
            onClick={() =>
              setLang(lang === 'en' ? 'bn' : 'en')
            }
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            {lang === 'en' ? 'বাংলা' : 'English'}
          </button>
        </div>

        {/* JSON Upload */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-xl font-semibold">
            Upload Requirements JSON
          </h2>

          <input
            type="file"
            accept=".json,application/json"
            onChange={handleJsonUpload}
          />
        </div>

        {/* PDF Upload */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-xl font-semibold">
            Upload PDF Documents
          </h2>

          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handlePdfUpload}
          />

          {uploadError && (
            <p className="mt-3 text-red-600">
              {uploadError}
            </p>
          )}
        </div>

        {/* Tender Information */}
        {tender && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 text-xl font-semibold">
              Tender Information
            </h2>

            <pre className="overflow-auto rounded bg-gray-100 p-4">
              {JSON.stringify(tender, null, 2)}
            </pre>
          </div>
        )}

        {/* Requirements */}
        {requirements.length > 0 && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">
              Requirements
            </h2>

            <div className="space-y-3">
              {requirements.map((req) => (
                <div
                  key={req.id}
                  className="rounded border p-4"
                >
                  <p className="font-medium">
                    {req.id}
                  </p>

                  <pre className="mt-2 overflow-auto text-sm">
                    {JSON.stringify(req, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded Files */}
        {Object.keys(uploadedFiles).length > 0 && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">
              Uploaded Files
            </h2>

            <div className="space-y-3">
              {Object.values(uploadedFiles).map((file) => {
                const isDuplicate =
                  duplicateFileIds.includes(file.id);

                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded border p-4"
                  >
                    <div>
                      <p className="font-medium">
                        {file.name}
                      </p>

                      <p className="text-sm text-gray-600">
                        Pages: {file.pageCount}
                      </p>

                      <p className="text-sm text-gray-600">
                        Hash: {file.hash}
                      </p>
                    </div>

                    {isDuplicate && (
                      <span className="rounded bg-red-100 px-3 py-1 text-sm text-red-700">
                        Duplicate
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicateFileIds.length > 0 && (
          <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="font-semibold text-yellow-800">
              Duplicate files detected
            </p>

            <p className="mt-1 text-sm text-yellow-700">
              {duplicateFileIds.length} duplicate file(s)
              found.
            </p>
          </div>
        )}

        {/* Generate Button */}
        <div className="rounded-lg bg-white p-6 shadow">
          <button
            disabled={isGenerating}
            onClick={async () => {
              try {
                setIsGenerating(true);

                // Add your existing generateTenderPackage()
                // implementation here when required.

                console.log(
                  'Generating tender package...'
                );
              } catch (error) {
                console.error(
                  'Failed to generate package:',
                  error
                );
              } finally {
                setIsGenerating(false);
              }
            }}
            className="rounded bg-green-600 px-5 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating
              ? 'Generating...'
              : 'Generate Tender Package'}
          </button>
        </div>
      </div>
    </div>
  );
}