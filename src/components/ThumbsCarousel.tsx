import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "./ui/card";

interface ThumbsCarouselProps {
  files: File[];
}

export function ThumbsCarousel({ files }: ThumbsCarouselProps) {
  return (
    <div className="py-4">
      <p className="text-center text-sm text-gray-400 mb-2">Selected Stories ({files.length}/5)</p>
      <Carousel opts={{ align: "start", loop: false }} className="w-full max-w-md mx-auto" effect="fade" transitionSpeed={10}>
        <CarouselContent className="-ml-2">
          {files.map((file, index) => (
            <CarouselItem key={index} className="pl-2 basis-1/3 md:basis-1/4 lg:basis-1/5">
              <div className="p-1">
                <Card>
                  <CardContent className="flex items-center justify-center p-1">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-auto rounded-md aspect-square object-cover"
                      onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)} // Clean up object URLs
                    />
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}