
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
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-300 text-lg font-sans">Upload Screenshot</p>
            {isOCRProcessing && (
              <Badge variant="secondary" className="bg-blue-600 font-sans">
                Processing OCR...
              </Badge>
            )}
          </div>
          <p className="text-gray-500 text-sm font-sans">JPG, JPEG, PNG • Max 10MB</p>
          
          {!uploadedImage && (
            <div className="border-2 border-dashed border-purple-500 rounded-xl p-8 bg-purple-500/5">
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <Upload className="w-8 h-8 text-purple-400" />
                <div className="bg-gray-700 px-6 py-3 rounded-lg border border-gray-600">
                  <span className="text-white font-sans">
                    {isOCRProcessing ? "Processing..." : "Choose file"}
                  </span>
                </div>
              </label>
            </div>
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
            <div className="mt-4 space-y-3">
              <img
                src={uploadedImage}
                alt="Uploaded screenshot"
                className="w-full max-w-lg mx-auto rounded-lg border border-gray-600 shadow-lg"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-block bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Change Screenshot
              </label>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
