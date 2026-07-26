
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
  onImageUpload,
}) => {
  return (
    <Card
      data-section="screenshot"
      className="border border-[#826f56]/15 bg-white/90 dark:border-white/10 dark:bg-[#151513] glass-surface"
    >
      <CardContent className="p-5 sm:p-6 md:p-7">
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center">
            <div className="w-full text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8f5b18] dark:text-[#d5aa67]">
                Step 1
              </p>
              <p className="text-lg font-display text-[#29231c] dark:text-[#f4efe7]">
                Upload your screenshot
              </p>
            </div>
            {isOCRProcessing && (
              <Badge
                variant="secondary"
                className="border border-[#b9cbe5] bg-[#eaf1fa] text-[#2f5d8c] dark:border-[#355981] dark:bg-[#102033] dark:text-[#7ea4d6]"
              >
                Extracting Text
              </Badge>
            )}
          </div>
          <p className="text-sm text-[#776b5d] dark:text-[#b4a89a]">
            PNG or JPG, up to 10MB.
          </p>
        </div>

        {!uploadedImage && (
          <label
            htmlFor="file-upload"
            className="mt-5 block cursor-pointer rounded-xl border border-[#826f56]/15 bg-white/70 p-5 text-center transition duration-300 hover:border-[#c49b5d]/45 hover:bg-[#fffcf7] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#c49b5d]/45 dark:hover:bg-white/[0.06] sm:p-6"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c49b5d]/15 text-[#a97d45] dark:text-[#d5aa67]">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-base font-medium text-[#29231c] dark:text-[#f4efe7]">
                Drop a file or browse
              </p>
              <p className="text-xs text-[#776b5d] dark:text-[#b4a89a]">
                We’ll start extracting text as soon as it uploads.
              </p>
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
            <div className="overflow-hidden rounded-xl border border-[#826f56]/15 bg-[#fffcf7] dark:border-white/10 dark:bg-[#0d0c0b]">
              <img
                src={uploadedImage}
                alt="Uploaded screenshot"
                className="mx-auto h-auto w-auto max-w-full"
              />
            </div>

            <div>
              <label
                htmlFor="file-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#826f56]/15 bg-white/80 px-4 py-2 text-sm text-[#29231c] transition-colors hover:bg-[#efe7dc] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#f4efe7] dark:hover:bg-white/[0.1]"
              >
                <Upload className="h-4 w-4" />
                Replace screenshot
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
