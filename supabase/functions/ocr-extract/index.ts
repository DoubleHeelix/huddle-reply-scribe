
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  const startTime = performance.now();
  
  try {
    console.log('OCR: Starting text extraction process');

    const { imageData, enableAutoCropping = true, margin = 12 }: OCRRequest = await req.json();

    if (!imageData) {
      throw new Error('Image data is required');
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      console.error('OCR: Google Cloud Vision API key not found in environment');
      throw new Error('Google Cloud Vision API key not configured');
    }

    console.log('OCR: Google API key found, length:', googleApiKey.length);
    console.log('OCR: API key starts with:', googleApiKey.substring(0, 10) + '...');

    // Remove data URL prefix if present
    const base64Data = imageData.startsWith('data:') 
      ? imageData.split(',')[1] 
      : imageData;

    console.log(`OCR: Processing image (${base64Data.length} characters of base64)`);

    // Construct the API URL
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`;
    console.log('OCR: API URL constructed (without key):', apiUrl.replace(/key=.*/, 'key=***'));

    // Prepare the request body
    const requestBody = {
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
    };

    console.log('OCR: Making request to Google Cloud Vision API...');
    console.log('OCR: Request body prepared, image content length:', base64Data.length);

    const visionResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`OCR: Vision API response status: ${visionResponse.status}`);
    console.log(`OCR: Vision API response headers:`, Object.fromEntries(visionResponse.headers.entries()));

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('OCR: Google Vision API error response (full):', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.error('OCR: Parsed error data:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('OCR: Could not parse error response as JSON');
        errorData = { error: { message: errorText } };
      }
      
      const errorMessage = errorData.error?.message || errorText || 'Unknown Google Vision API error';
      
      // Check for specific error types and provide helpful messages
      if (errorMessage.includes('billing') || errorMessage.includes('BILLING_DISABLED')) {
        const projectInfo = errorData.error?.details?.find(d => d.metadata?.consumer);
        const projectId = projectInfo?.metadata?.consumer?.replace('projects/', '') || 'unknown';
        throw new Error(`Billing issue detected for project ${projectId}. Please verify billing is enabled and the API key has the correct project permissions. Full error: ${errorMessage}`);
      } else if (errorMessage.includes('API key not valid') || errorMessage.includes('INVALID_ARGUMENT')) {
        throw new Error(`Invalid Google Cloud API key. Please check your API key configuration. Full error: ${errorMessage}`);
      } else if (errorMessage.includes('not been used') || errorMessage.includes('disabled') || errorMessage.includes('PERMISSION_DENIED')) {
        throw new Error(`Google Cloud Vision API access issue. Please ensure the API is enabled and has proper permissions. Full error: ${errorMessage}`);
      } else {
        throw new Error(`Google Vision API error (${visionResponse.status}): ${errorMessage}`);
      }
    }

    const visionData = await visionResponse.json();
    console.log('OCR: Google Vision API response received successfully');
    console.log('OCR: Response structure:', JSON.stringify(visionData, null, 2));

    // Extract text from response
    let extractedText = '';
    if (visionData.responses?.[0]?.textAnnotations?.[0]?.description) {
      extractedText = visionData.responses[0].textAnnotations[0].description;
      console.log(`OCR: Successfully extracted ${extractedText.length} characters`);
      console.log(`OCR: First 100 chars: ${extractedText.substring(0, 100)}`);
    } else if (visionData.responses?.[0]?.error) {
      const apiError = visionData.responses[0].error;
      console.error('OCR: Vision API returned error in response:', apiError);
      throw new Error(`Vision API error: ${apiError.message || 'Unknown error'}`);
    } else {
      console.log('OCR: No text detected in image');
      extractedText = 'No text detected in the image.';
    }

    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;

    console.log(`OCR: Processing completed successfully in ${processingTime.toFixed(2)} seconds`);

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
    const processingTime = (endTime - startTime) / 1000;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    console.error('OCR: Error during processing:', error);
    console.error('OCR: Error stack trace:', error.stack);

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
