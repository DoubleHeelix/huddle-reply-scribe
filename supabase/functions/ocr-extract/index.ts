
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRRequest {
  imageData: string; // base64 encoded image
  enableAutoCropping?: boolean;
  margin?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = performance.now();
    console.log('OCR: Starting text extraction process');

    const { imageData, enableAutoCropping = true, margin = 12 }: OCRRequest = await req.json();

    if (!imageData) {
      throw new Error('Image data is required');
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google Cloud Vision API key not configured');
    }

    // Remove data URL prefix if present
    const base64Data = imageData.startsWith('data:') 
      ? imageData.split(',')[1] 
      : imageData;

    console.log(`OCR: Processing image (${base64Data.length} characters of base64)`);

    // Call Google Cloud Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Data,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errorData = await visionResponse.json();
      console.error('OCR: Google Vision API error:', errorData);
      throw new Error(`Google Vision API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const visionData = await visionResponse.json();
    console.log('OCR: Google Vision API response received');

    // Extract text from response
    let extractedText = '';
    if (visionData.responses?.[0]?.textAnnotations?.[0]?.description) {
      extractedText = visionData.responses[0].textAnnotations[0].description;
      console.log(`OCR: Successfully extracted ${extractedText.length} characters`);
    } else {
      console.log('OCR: No text detected in image');
      extractedText = 'No text detected in the image.';
    }

    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;

    console.log(`OCR: Processing completed in ${processingTime.toFixed(2)} seconds`);

    return new Response(
      JSON.stringify({
        text: extractedText.trim(),
        processingTime,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const endTime = performance.now();
    const processingTime = (performance.now() - (performance.now() - 1000)) / 1000;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    console.error('OCR: Error during processing:', error);

    return new Response(
      JSON.stringify({
        text: '',
        processingTime,
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
