import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { supabase } from '@/integrations/supabase/client';

// Define the type for the Deepgram client instance
type DeepgramClient = LiveClient;

export const useTranscription = () => {
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "listening" | "error">("idle");
  const [interimTranscript, setInterimTranscript] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const deepgramRef = useRef<DeepgramClient | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const getTemporaryApiKey = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User not authenticated. Cannot fetch Deepgram token.");
      }

      const { data, error } = await supabase.functions.invoke('deepgram-token', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.key) {
        throw new Error("API key not found in server response.");
      }
      
      return data.key;
    } catch (error) {
      console.error("Error fetching Deepgram token:", error);
      // You could add a user-facing notification here
      return null;
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (deepgramRef.current) {
      deepgramRef.current.finish();
      deepgramRef.current = null;
    }
    setConnectionStatus("idle");
  }, []);


  const startRecording = useCallback(async () => {
    setInterimTranscript('');
    setFullTranscript('');
    setConnectionStatus("connecting");

    const apiKey = await getTemporaryApiKey();
    if (!apiKey) {
      setConnectionStatus("error");
      return;
    }

    const deepgram = createClient(apiKey);
    const connection = deepgram.listen.live({
      model: 'nova-2',
      interim_results: true,
      smart_format: true,
      utterance_end_ms: 2000, // Consider an utterance complete after 2s of silence.
    });

    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log('Deepgram connection opened.');
      setConnectionStatus("listening");

      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && connection.getReadyState() === 1) {
            connection.send(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log('MediaRecorder stopped.');
          // The stopRecording function will handle finishing the Deepgram connection
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(250); // Start recording and send data every 250ms
      }).catch((err) => {
        console.error("Error accessing microphone:", err);
        setConnectionStatus("error");
        // Handle microphone permission denial in the UI
      });
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript) {
        if (data.is_final) {
          // When a segment is final, append it to the full transcript
          // and clear the interim transcript.
          setFullTranscript((prev) => prev + transcript + ' ');
          setInterimTranscript('');
        } else {
          // Otherwise, just update the interim transcript.
          setInterimTranscript(transcript);
        }
      }
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log('Deepgram connection closed.');
      // The user clicking the button is the source of truth for stopping.
      // We only stop the media recorder here to be safe.
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      // If the connection closes unexpectedly, we should reflect that in the UI.
      setConnectionStatus("idle");
    });
    
    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('Deepgram error:', error);
      stopRecording();
    });

    deepgramRef.current = connection;
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    connectionStatus,
    transcript: `${fullTranscript}${interimTranscript}`, // Combine for a seamless display
    startRecording,
    stopRecording,
  };
};