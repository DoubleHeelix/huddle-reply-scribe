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
    <Card className="border-[#826f56]/15 bg-white/90 dark:border-white/10 dark:bg-[#151513]">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-[#c49b5d] bg-[#c49b5d]/10" : "border-[#c49b5d]/50"
          } ${isProcessing ? 'cursor-not-allowed opacity-50' : 'hover:border-[#c49b5d] hover:bg-[#c49b5d]/10'}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-[#a97d45] dark:text-[#d5aa67]" />
          <p className="mt-4 text-sm text-[#776b5d] dark:text-[#b4a89a]">
            {isDragActive
              ? "Drop the stories here..."
              : `Drag & drop up to ${maxFiles} stories here, or click to select`}
          </p>
          <div className="mt-4">
            <div className="bg-[#c49b5d] px-6 py-3 rounded-lg border border-[#c49b5d] inline-block hover:bg-[#b58a52]">
              <span className="text-[#071326] font-sans">
                {isProcessing ? "Processing..." : "Choose story images"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
