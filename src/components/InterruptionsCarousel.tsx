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
        return <Badge variant="secondary" className="bg-[#776b5d] text-white animate-pulse">Uploading...</Badge>;
      case 'ocr':
        return <Badge variant="secondary" className="border border-[#b9cbe5] bg-[#eaf1fa] text-[#2f5d8c] animate-pulse">Reading text...</Badge>;
      case 'generating':
        return <Badge variant="secondary" className="border border-[#c49b5d]/30 bg-[#c49b5d]/20 text-[#8f5b18] animate-pulse">Generating...</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="border border-[#348f6a]/30 bg-[#bcefd8] text-[#23684c]">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <Carousel className="w-full max-w-lg mx-auto" effect="fade" transitionSpeed={10}>
      <CarouselContent className="bg-white/70 rounded-lg dark:bg-[#171513]">
        {stories.map((story) => (
          <CarouselItem key={story.id}>
            <div className="p-1">
              <Card className="border-[#826f56]/15 bg-white/90 text-[#29231c] dark:border-white/10 dark:bg-[#171513] dark:text-[#f4efe7]">
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
                            staggerChildren: 0.2,
                          },
                        },
                      }}
                    >
                      <h4 className="text-lg font-semibold text-center text-[#29231c] flex items-center justify-center gap-2 dark:text-[#f4efe7]">
                        <Sparkles className="w-5 h-5 text-[#a97d45] dark:text-[#d5aa67]" />
                        AI Suggestions
                      </h4>
                      {story.interruptions.map((interruption, i) => (
                        <motion.div
                          key={i}
                          variants={{
                            hidden: { opacity: 0, y: 30 },
                            visible: {
                              opacity: 1,
                              y: 0,
                              transition: {
                                type: "spring",
                                stiffness: 100,
                                damping: 10,
                              },
                            },
                          }}
                          className="relative p-px overflow-hidden rounded-lg bg-transparent transition-all duration-300 hover:scale-[1.02]"
                        >
                          <div className="absolute inset-0 bg-[#c49b5d]" />
                          <div className="relative flex items-center gap-3 p-3 rounded-[7px] bg-[#fffcf7] dark:bg-[#171513]">
                            <p className="flex-grow text-sm font-medium text-[#29231c] dark:text-[#f4efe7]">{interruption}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(interruption)}
                              className="text-[#776b5d] hover:text-[#29231c] hover:bg-[#efe7dc] flex-shrink-0 dark:text-[#b4a89a] dark:hover:text-[#f4efe7] dark:hover:bg-white/[0.08]"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {(story.status === 'ocr' || story.status === 'generating') && (
                    <div className="flex items-center gap-2 text-[#776b5d] dark:text-[#b4a89a]">
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
      <CarouselPrevious className="border-[#826f56]/15 bg-white text-[#29231c] hover:bg-[#efe7dc] dark:border-white/10 dark:bg-[#171513] dark:text-[#f4efe7] dark:hover:bg-white/[0.08]" />
      <CarouselNext className="border-[#826f56]/15 bg-white text-[#29231c] hover:bg-[#efe7dc] dark:border-white/10 dark:bg-[#171513] dark:text-[#f4efe7] dark:hover:bg-white/[0.08]" />
    </Carousel>
  );
}
