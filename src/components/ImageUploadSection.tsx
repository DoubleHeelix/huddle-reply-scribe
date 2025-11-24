
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload } from "lucide-react";

interface ImageUploadSectionProps {
  uploadedImage: string | null;
  isOCRProcessing: boolean;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ImageUploadSection: React.FC<ImageUploadSectionProps> = ({
  uploadedImage,
  isOCRProcessing,
  onImageUpload
}) => {
  return (
    <Card className="bg-slate-900/70 border-white/5 glass-surface">
      <CardContent className="p-5 sm:p-6 md:p-7">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-full text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Step 1</p>
              <p className="text-lg font-display">Upload your screenshot</p>
            </div>
            {isOCRProcessing && (
              <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-100 border border-cyan-500/20">
                Processing OCR...
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-400">PNG or JPG, up to 10MB. We’ll auto-read the text so you don’t have to retype context.</p>
        </div>

        {!uploadedImage && (
          <label
            htmlFor="file-upload"
            className="mt-5 block cursor-pointer rounded-xl border border-white/10 bg-white/5 p-5 sm:p-6 text-center transition duration-300 hover:border-white/20 hover:bg-white/10"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-purple-500/15 text-purple-200 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-base font-medium">Drop a file or browse</p>
              <p className="text-xs text-slate-400">We’ll start extracting text as soon as it uploads.</p>
            </div>
          </label>
        )}

        <Input
          type="file"
          accept="image/*"
          onChange={onImageUpload}
          className="hidden"
          id="file-upload"
          disabled={isOCRProcessing}
        />

        {uploadedImage && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900/60">
              <img
                src={uploadedImage}
                alt="Uploaded screenshot"
                className="mx-auto h-auto w-auto max-w-full"
              />
            </div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                Replace screenshot
              </label>
              <Badge variant="outline" className="border-emerald-400/40 text-emerald-200 bg-emerald-400/10">
                Captured
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
