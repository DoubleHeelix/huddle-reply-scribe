import { Upload } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "./ui/card";

interface MultiImageUploadProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
  maxFiles?: number;
}

export function MultiImageUpload({ onFilesSelected, isProcessing, maxFiles = 5 }: MultiImageUploadProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      onFilesSelected(acceptedFiles.slice(0, maxFiles));
    },
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple: true,
    maxFiles,
    disabled: isProcessing,
  });

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-purple-400 bg-purple-500/10" : "border-purple-500/50"
          } ${isProcessing ? 'cursor-not-allowed opacity-50' : 'hover:border-purple-400 hover:bg-purple-500/10'}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-purple-400" />
          <p className="mt-4 text-sm text-gray-400">
            {isDragActive
              ? "Drop the stories here..."
              : `Drag & drop up to ${maxFiles} stories here, or click to select`}
          </p>
          <div className="mt-4">
            <div className="bg-gray-700 px-6 py-3 rounded-lg border border-gray-600 inline-block">
              <span className="text-white font-sans">
                {isProcessing ? "Processing..." : "Choose story images"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}