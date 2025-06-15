
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
          
          <div className="border-2 border-dashed border-purple-500 rounded-xl p-8 bg-purple-500/5">
            <Input
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              className="hidden"
              id="file-upload"
              disabled={isOCRProcessing}
            />
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
          
          {uploadedImage && (
            <div className="mt-4 space-y-3">
              <img 
                src={uploadedImage} 
                alt="Uploaded screenshot" 
                className="w-full max-w-lg mx-auto rounded-lg border border-gray-600 shadow-lg"
              />
              <div className="flex gap-2 justify-center items-center flex-wrap">
                <Badge variant="secondary" className="font-sans">Screenshot uploaded</Badge>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
