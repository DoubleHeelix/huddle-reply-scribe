
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCcw, MessageSquare, Calendar, User } from 'lucide-react';
import { useHuddlePlays } from '@/hooks/useHuddlePlays';
import { formatDistanceToNow } from 'date-fns';

export const PastHuddlesTab = () => {
  const { huddlePlays, isLoading, error, refetch } = useHuddlePlays();

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 text-purple-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
          <span className="font-sans">Loading past huddles...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <p className="text-red-400 mb-4 font-sans">Error loading past huddles: {error}</p>
          <Button onClick={refetch} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 font-sans">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (huddlePlays.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-white text-lg font-medium mb-2 font-sans">No Past Huddles Yet</h3>
          <p className="text-gray-400 font-sans">
            Start creating huddle plays to build your conversation history and improve future suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white text-lg font-medium font-sans">
          Past Huddles ({huddlePlays.length})
        </h3>
        <Button 
          onClick={refetch} 
          variant="outline" 
          size="sm"
          className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 font-sans"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {huddlePlays.map((huddle) => (
          <Card key={huddle.id} className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400 text-sm font-sans">
                    {formatDistanceToNow(new Date(huddle.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex gap-2">
                  {huddle.selected_tone && huddle.selected_tone !== 'none' && (
                    <Badge variant="secondary" className="font-sans">
                      {huddle.selected_tone}
                    </Badge>
                  )}
                  {huddle.final_reply && (
                    <Badge variant="outline" className="text-green-400 border-green-400 font-sans">
                      Tone Adjusted
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-gray-300 text-sm font-medium mb-1 font-sans">Context:</p>
                  <p className="text-gray-400 text-sm font-sans line-clamp-2">
                    {huddle.screenshot_text.substring(0, 150)}...
                  </p>
                </div>

                <div>
                  <p className="text-gray-300 text-sm font-medium mb-1 font-sans">Your Draft:</p>
                  <p className="text-gray-200 text-sm font-sans line-clamp-2">
                    {huddle.user_draft}
                  </p>
                </div>

                <div>
                  <p className="text-gray-300 text-sm font-medium mb-1 font-sans">
                    {huddle.final_reply ? 'Final Reply:' : 'Generated Reply:'}
                  </p>
                  <div className="bg-gray-900 p-3 rounded-lg border border-gray-600">
                    <p className="text-white text-sm font-sans">
                      {huddle.final_reply || huddle.generated_reply}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
