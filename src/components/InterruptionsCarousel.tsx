import { Story } from "@/types/story";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "./ui/button";
import { Copy, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "./ui/badge";
import { useToast } from "./ui/use-toast";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface InterruptionsCarouselProps {
  stories: Story[];
}

export function InterruptionsCarousel({ stories }: InterruptionsCarouselProps) {
  const { toast } = useToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard.",
    });
  };

  const getStatusBadge = (status: Story['status']) => {
    switch (status) {
      case 'uploading':
        return <Badge variant="secondary" className="bg-gray-500 animate-pulse">Uploading...</Badge>;
      case 'ocr':
        return <Badge variant="secondary" className="bg-blue-600 animate-pulse">Reading text...</Badge>;
      case 'generating':
        return <Badge variant="secondary" className="bg-yellow-500 animate-pulse">Generating...</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-600">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <Carousel className="w-full max-w-lg mx-auto">
      <CarouselContent className="bg-gray-800 rounded-lg">
        {stories.map((story) => (
          <CarouselItem key={story.id}>
            <div className="p-1">
              <Card className="bg-gray-800 border-gray-700 text-white">
                <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-full relative">
                    <img
                      src={story.previewUrl}
                      alt={`Story screenshot`}
                      className="w-full h-auto rounded-lg"
                    />
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(story.status)}
                    </div>
                  </div>

                  {story.status === 'completed' && (
                    <motion.div
                      className="w-full space-y-3"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: {
                          transition: {
                            staggerChildren: 0.1,
                          },
                        },
                      }}
                    >
                      <h4 className="text-lg font-semibold text-center text-white flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        AI Suggestions
                      </h4>
                      {story.interruptions.map((interruption, i) => (
                        <motion.div
                          key={i}
                          variants={{
                            hidden: { opacity: 0, y: 20 },
                            visible: { opacity: 1, y: 0 },
                          }}
                          className="relative p-px overflow-hidden rounded-lg bg-transparent transition-all duration-300 hover:scale-[1.02]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500" />
                          <div className="relative flex items-center gap-3 p-3 rounded-[7px] bg-gray-800">
                            <p className="flex-grow text-sm font-medium text-white">{interruption}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(interruption)}
                              className="text-gray-400 hover:text-white hover:bg-gray-700/50 flex-shrink-0"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {(story.status === 'ocr' || story.status === 'generating') && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  )}

                  {story.status === 'error' && (
                     <div className="flex items-center gap-2 text-red-400">
                       <AlertTriangle className="h-5 w-5" />
                       <span>{story.error}</span>
                     </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="text-white bg-gray-800 hover:bg-gray-700" />
      <CarouselNext className="text-white bg-gray-800 hover:bg-gray-700" />
    </Carousel>
  );
}