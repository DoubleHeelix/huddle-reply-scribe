
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, MessageSquare, Brain } from "lucide-react";
import { HuddleSource, DocumentSource } from "@/hooks/useEnhancedAISuggestions";

interface AISourcesProps {
  sources: {
    huddles: HuddleSource[];
    documents: DocumentSource[];
  };
}

export const AISources = ({ sources }: AISourcesProps) => {
  const hasHuddles = sources.huddles && sources.huddles.length > 0;
  const hasDocuments = sources.documents && sources.documents.length > 0;

  if (!hasHuddles && !hasDocuments) {
    return null;
  }

  return (
    <Card className="bg-gray-800 border-gray-700 mt-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI Learning Sources
        </CardTitle>
        <p className="text-gray-400">
          The AI used these sources to generate your improved reply. Learn from these examples to improve your own communication.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={hasHuddles ? "huddles" : "documents"} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-700">
            {hasHuddles && (
              <TabsTrigger value="huddles" className="text-white data-[state=active]:bg-gray-600">
                <MessageSquare className="w-4 h-4 mr-2" />
                Past Huddles ({sources.huddles.length})
              </TabsTrigger>
            )}
            {hasDocuments && (
              <TabsTrigger value="documents" className="text-white data-[state=active]:bg-gray-600">
                <BookOpen className="w-4 h-4 mr-2" />
                Documents ({sources.documents.length})
              </TabsTrigger>
            )}
          </TabsList>

          {hasHuddles && (
            <TabsContent value="huddles" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {sources.huddles.map((huddle, index) => (
                    <Card key={huddle.id} className="bg-gray-700 border-gray-600">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm font-medium text-white">
                            Similar Conversation #{index + 1}
                          </CardTitle>
                          <Badge variant="secondary" className="bg-purple-600 text-white">
                            {(huddle.similarity * 100).toFixed(1)}% match
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            Context
                          </h4>
                          <p className="text-sm text-gray-300 bg-gray-800 p-2 rounded">
                            {huddle.screenshot_text.length > 150 
                              ? `${huddle.screenshot_text.substring(0, 150)}...`
                              : huddle.screenshot_text
                            }
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            Original Draft
                          </h4>
                          <p className="text-sm text-gray-300 bg-gray-800 p-2 rounded">
                            {huddle.user_draft}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            Successful Reply
                          </h4>
                          <p className="text-sm text-green-300 bg-gray-800 p-2 rounded border-l-2 border-green-500">
                            {huddle.final_reply}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {hasDocuments && (
            <TabsContent value="documents" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {sources.documents.map((doc, index) => (
                    <Card key={doc.id} className="bg-gray-700 border-gray-600">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm font-medium text-white">
                            {doc.document_name}
                          </CardTitle>
                          <Badge variant="secondary" className="bg-blue-600 text-white">
                            {(doc.similarity * 100).toFixed(1)}% relevant
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div>
                          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            Relevant Section
                          </h4>
                          <p className="text-sm text-gray-300 bg-gray-800 p-3 rounded border-l-2 border-blue-500">
                            {doc.content_chunk}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
};
