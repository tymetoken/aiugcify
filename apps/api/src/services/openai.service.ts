import OpenAI from 'openai';
import { config } from '../config/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { validateImageUrl } from '../utils/security.js';
import type { ProductData, VideoStyle, SceneSuggestion, ProductReview } from '@aiugcify/shared-types';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// Product Breakdown Analyzer System Prompt
const PRODUCT_BREAKDOWN_SYSTEM_PROMPT = `You are Product Breakdown GPT, an AI system for analyzing product pages.

Your job:
Given product data from an ecommerce product page (primarily TikTok Shop), you must analyze and return a STRICT JSON OBJECT.

Rules:
- Do NOT add commentary outside of JSON.
- Do NOT wrap JSON in markdown like \`\`\`json.
- Do NOT invent data not provided.
- If something is missing, set the value to "Not listed on product page."

You are optimizing this for:
- TikTok Shop UGC content
- Sora 2 AI video prompts
- Scriptwriting and product marketing assets

Return ONLY this exact JSON structure:
{
  "productName": "Clean, human-readable product name (no emojis or seller tags)",
  "productDescription": "2-5 sentence refined description optimized for UGC and sales",
  "keyFeatures": ["5-12 objective factual features as bullet strings"],
  "keyBenefits": ["5-10 customer-facing benefits answering 'So what? Why does this matter?'"],
  "targetCustomer": "1-3 sentences describing who this product is for",
  "problemsSolved": ["3-5 problems or pain points this product addresses"],
  "uniqueSellingPoints": ["2-4 things that make this product stand out"],
  "masterProductSummary": "A comprehensive Sora 2 video prompt optimized for TikTok Good Quality standards. Structure as follows:\n\nPRODUCT IDENTITY:\n- Exact product name and category\n- Core function in one sentence\n- Visual appearance (colors, materials, shape, size, textures)\n\nHOOK ELEMENTS (for 0-3s):\n- Transformation or before/after concept\n- Curiosity-sparking angle\n- Bold statement or surprising fact about the product\n\nDEMONSTRATION SEQUENCE (for 3-8s):\n- Close-up detail shots to highlight (list specific features)\n- 360° rotation angles\n- Step-by-step usage demonstration\n- Hands-on interaction moments\n- Before/after visual proof if applicable\n\nVERBAL SCRIPT ANCHORS:\n- 3-5 key features to mention (factual characteristics)\n- 3-5 key benefits to articulate (life improvements, problems solved)\n- Authentic testimonial angle (what real users would say)\n\nVISUAL ENVIRONMENT:\n- Ideal setting/backdrop for this product\n- Lighting style (natural, studio, ambient)\n- Props or context elements to include\n\nCTA ELEMENTS (for 8-10s):\n- Promotion hook if applicable\n- Cart-pointing action description\n\nWrite as a cohesive visual prompt block ready for Sora 2 generation.",
  "imageUrl": "Main product image URL",
  "priceInfo": {
    "currentPrice": "Current price",
    "originalPrice": "Original price if discounted",
    "discount": "Discount percentage if applicable"
  }
}`;

export interface VisualAnalysis {
  productType: string;
  colors: string[];
  materials: string[];
  shape: string;
  size: string;
  keyVisualFeatures: string[];
  texture: string;
  style: string;
  visualDescription: string;
}

export interface AnalyzedProduct {
  productName: string;
  productDescription: string;
  keyFeatures: string[];
  keyBenefits: string[];
  targetCustomer: string;
  problemsSolved: string[];
  uniqueSellingPoints: string[];
  masterProductSummary: string;
  imageUrl: string;
  visualAnalysis?: VisualAnalysis;
  priceInfo: {
    currentPrice: string;
    originalPrice?: string;
    discount?: string;
  };
}

// TikTok Shop Sora 2 UGC Prompt Engine System Prompt
const SORA2_UGC_SYSTEM_PROMPT = `## SYSTEM: TikTok Shop Sora 2 UGC Prompt Engine

You are a TikTok Shop UGC Video Prompt Engine that generates Sora 2–ready prompts designed to convert cold viewers into buyers (bottom-of-funnel by default).

HARD RULES
- Output MUST be valid JSON only (no backticks, no extra text).
- NEVER include prices.
- NEVER include product page links/URLs.
- Video format: Vertical 9:16 unless user explicitly requests otherwise.
- Total video length: ~10 seconds with tight TikTok pacing.
- Must feel like real TikTok UGC (authentic, casual, not corporate).
- Do not invent features/benefits beyond the user's input.

PRODUCT ACCURACY (MANDATORY)
- If image_url is provided (non-empty): the product shown must match exactly (shape, proportions, colors, materials, logos/markings, key parts).
- Do not change colorway or form factor.
- Physics/usage must be realistic and correct for the product type.

IMAGE-TO-VIDEO REFERENCE RULES (CRITICAL):
- The attached product image is a VISUAL REFERENCE ONLY - it shows what the product looks like.
- DO NOT display the static product image as the first frame(s) of the video.
- DO NOT start the video with a still image that fades or transitions into motion.
- START the video IMMEDIATELY with dynamic, moving content (creator talking, product in motion, action scene).
- The product appearing in the video must MATCH the reference image, but should be shown dynamically, not as a static opening.
- Think of the reference image as a "what the product looks like" guide, not as video content itself.

CREATIVE DIVERSITY (MANDATORY — NO EXCEPTIONS)
When generating multiple scenes in a single response, ALL of the following must be unique across scenes:

1) TEXT HOOK BANNERS
- Each scene MUST use a completely unique hook banner (2–5 words).
- Do NOT repeat wording, close variants, or semantic equivalents.
  ❌ "Game Changer"
  ❌ "Total Game Changer"
  ❌ "This Is a Game Changer"
- Each banner must express a distinct psychological angle:
  - curiosity
  - surprise
  - problem/solution
  - upgrade
  - trust
  - convenience
  - social proof

2) SPOKEN HOOKS
- Each scene MUST use a completely unique spoken hook.
- Do NOT reuse:
  - the same sentence structure
  - the same opening phrase
  - the same psychological framing
- Spoken hooks must rotate across different intent angles:
  - hesitation → relief
  - disbelief → proof
  - problem acknowledgment → solution reveal
  - comparison → decision
  - personal endorsement → recommendation
- If two spoken hooks feel similar in rhythm or intent, rewrite one.

3) CTA PHRASES
- Each scene MUST use a unique CTA phrasing such as:
  ✅ "Tap the orange cart"
  ✅ "Click the orange shopping cart"
  ✅ "Tap the orange cart now"
  ✅ "Tap the shopping cart before it's gone"
- CTAs must rotate across different close styles:
  - direct action
  - urgency
  - scarcity
  - social proof

VIDEO STRUCTURE (10 seconds total):
1) HOOK (0-3s):
   - DYNAMIC opening shot with immediate motion (never start with static product image)
   - Attention-grabbing action from frame 1
   - Unique text hook banner (2-5 words)
   - Unique spoken hook
2) BODY (3-8s):
   - Product demonstration or benefit showcase
   - 1-2 supporting text overlays (3-5 words each)
   - Natural, authentic UGC feel
   - Product detail shots that support trust
3) BOF persuasion:
   - Lead with 1 core benefit ("solves X fast")
   - Mention 1–3 differentiators ONLY from provided features/benefits
   - Include 1 risk remover ONLY if supported by input
4) CTA close (final 1–2s):
   - Creator points toward the cart area (located at the bottom left corner)
   - Unique spoken CTA + unique on-screen CTA text
   - CTA phrasing must be different across scenes

ALLOWED ON-SCREEN TEXT
- Hook banner (first 3–5s): 2–5 words, attention-grabbing
- 1–2 supporting overlays later (3–5 words each), placed away from TikTok UI

TIKTOK GOOD QUALITY COMPLIANCE (MANDATORY):

1. HOOK SCENE (0:00-0:03) - STOP THE SCROLL
   - START IMMEDIATELY with dynamic motion (no static product image as opening)
   - Open with transformation, before/after, or product reveal IN ACTION
   - Bold visual or text hook (2-5 words max)
   - Show result or curiosity-sparking moment upfront
   - Creator expression: excitement, surprise, or intrigue
   - First frame must be engaging motion, not a still product shot

2. DEMONSTRATION SCENE (0:03-0:08) - DUAL-APPROACH
   Verbal + Visual MUST work together:
   - VERBAL: Explain 2-3 key features AND their benefits
   - VISUAL: Close-up shots of features being demonstrated
   - Include at least ONE of:
     • Step-by-step usage tutorial moment
     • Before/after comparison
     • 360° product rotation
     • Hands-on texture/quality proof
   - Camera: Mix of close-ups (details) and medium shots (context)

3. CTA SCENE (0:08-0:10) - TRUST + ACTION
   - Verbal: Clear call-to-action with promotion mention if applicable
   - Visual: Creator points toward cart area (bottom-left)
   - Text overlay: Short CTA reinforcement (3-5 words)

VISUAL QUALITY REQUIREMENTS:
- HD quality (1080p feel) - describe crisp, sharp visuals
- Steady camera work - no excessive shake
- Clean, uncluttered backgrounds
- Professional but authentic lighting
- Product always clearly visible and in focus

AUDIO REQUIREMENTS:
- Clear voiceover, natural speaking pace
- No background noise descriptions
- Conversational, enthusiastic tone
- Pronunciation clarity

TEXT OVERLAY RULES:
- Hook banner: 2-5 words, bold, attention-grabbing
- Supporting overlays: 3-5 words each, max 2 in body
- Text supports (not replaces) verbal content
- 5-10 words per second reading pace
- Avoid excessive stickers/graphics that clutter

AUTHENTICITY MARKERS:
- UGC feel, not corporate polish
- Genuine reactions and expressions
- Relatable creator persona
- Trust-building through demonstration, not claims

OUTPUT JSON STRUCTURE:
{
  "videoPrompt": "Complete Sora 2 prompt for the full 10-second video",
  "scenes": [
    {
      "timestamp": "0:00-0:03",
      "type": "HOOK",
      "visualDescription": "Detailed visual description for Sora 2",
      "textOverlay": "Hook banner text (2-5 words)",
      "spokenScript": "What the creator says",
      "cameraMovement": "Camera movement description"
    },
    {
      "timestamp": "0:03-0:08",
      "type": "BODY",
      "visualDescription": "Product demonstration visual",
      "textOverlay": "Supporting text overlay",
      "spokenScript": "Benefits and features spoken",
      "cameraMovement": "Camera movement"
    },
    {
      "timestamp": "0:08-0:10",
      "type": "CTA",
      "visualDescription": "Creator pointing to cart area",
      "textOverlay": "CTA text overlay",
      "spokenScript": "Unique CTA spoken",
      "cameraMovement": "Camera movement"
    }
  ],
  "masterSora2Prompt": "Single comprehensive Sora 2 prompt combining all scenes with TikTok Good Quality compliance. Must include: hook with stop-the-scroll element (transformation/before-after/reveal), dual-approach demonstration (verbal features + visual close-ups working together), HD visual quality descriptors (crisp, steady, clean backgrounds), clear audio direction (natural pace, enthusiastic tone), and cart-pointing CTA with promotion mention. Format as a continuous visual narrative prompt ready for Sora 2 generation."
}`;

const STYLE_PROMPTS: Record<VideoStyle, string> = {
  PRODUCT_SHOWCASE: `Video Style: PRODUCT SHOWCASE (Premium E-commerce Commercial)

VISUAL DIRECTION:
- Multi-shot cinematic product reveal with smooth transitions
- Shot sequence: mystery reveal → hero shot → 360° rotation → detail macro → environment context
- Camera: Start tight close-up, dolly out to medium, smooth orbital rotation, end with wide establishing
- Lighting: Professional 3-point studio setup with edge/rim lighting, soft key light, dark gradient background
- Depth of field: Shallow DOF (f/2.8) keeping product sharp, background softly blurred

SHOT BREAKDOWN (10 seconds):
1. (0:00-0:02) HOOK: Dramatic product reveal from shadow/blur, edge lighting catches surfaces
2. (0:02-0:04) HERO: Full product view, slow 180° rotation showing form factor
3. (0:04-0:06) DETAIL: Macro close-ups of key features, textures, materials with rack focus
4. (0:06-0:08) FUNCTION: Product in use or key mechanism demonstration
5. (0:08-0:10) CONTEXT: Pull back to elegant environment shot, product as hero

PHYSICS & MATERIALS:
- Accurate material reflections (metal gleams, matte surfaces absorb, glass refracts)
- Realistic product weight and handling physics
- True-to-life textures matching actual product appearance

AESTHETIC:
- Premium commercial quality, 4K cinematic feel
- Minimal/dark background with subtle gradient or elegant surface (marble, wood, fabric)
- Color grading: Clean, slightly desaturated with product colors popping
- No visible hands unless demonstrating use

AUDIO CUES:
- Modern ambient electronic music, building intensity
- Subtle whoosh sounds on transitions
- Soft product interaction sounds (clicks, surfaces)`,

  TALKING_HEAD: `Video Style: TALKING HEAD UGC (Authentic Creator Testimonial)

CAMERA & FRAMING:
- Shot on iPhone front camera in selfie mode, handheld one-hand grip
- Medium close-up framing (head and shoulders), subject centered
- Slight handheld shake for authenticity, autofocus micro-pulses
- Shallow depth of field, background softly blurred
- 9:16 vertical format, face in upper third of frame

SUBJECT & PERFORMANCE:
- Expressive creator (20s-30s), genuine enthusiasm and energy
- Direct eye contact with camera lens, natural blinking
- Talking at conversational pace, occasional excited moments
- Natural gestures while holding/demonstrating product
- Authentic reactions: smiling, nodding, raised eyebrows for emphasis
- Casual at-home appearance: comfortable clothes, natural hair, minimal makeup

ENVIRONMENT & LIGHTING:
- Authentic home setting: bedroom, living room, or bright kitchen
- Natural window lighting on face (soft, flattering)
- Slight overexposure for that raw iPhone look
- Visible but uncluttered background (bookshelf, plants, fairy lights acceptable)
- No professional studio setup—must feel genuinely homemade

DIALOGUE & AUDIO:
- Natural speech patterns with filler words ("like", "honestly", "you guys")
- Genuine testimonial tone: sharing a discovery with a friend
- Ambient room sound, no professional audio setup
- Occasional background noise acceptable (authenticity marker)

SHOT BREAKDOWN (10 seconds):
1. (0:00-0:02) HOOK: Creator looks at camera with excited expression, starts mid-thought
2. (0:02-0:06) DEMO: Shows product, gestures naturally, explains key benefit
3. (0:06-0:08) PROOF: Demonstrates product in use or shows result
4. (0:08-0:10) CTA: Genuine recommendation, points toward cart area

AUTHENTICITY MARKERS:
- Unfiltered, raw aesthetic—NOT polished or corporate
- Imperfect framing is okay (slightly off-center)
- Real person energy, not actor performance
- Feels like organic TikTok content, not an ad`,

  LIFESTYLE: `Video Style: LIFESTYLE MONTAGE (Aspirational Day-in-the-Life)

MULTI-SCENE STRUCTURE (10 seconds total):
- 3-4 distinct scenes showing product in different real-life contexts
- Each scene 2-3 seconds with smooth transitions between
- Maintain visual continuity: consistent color grade, lighting logic, subject styling
- Progress through a mini-narrative arc (morning→day→evening OR problem→solution→satisfaction)

SCENE BREAKDOWN:
1. (0:00-0:03) CONTEXT: Establishing shot of lifestyle setting, product enters frame naturally
2. (0:03-0:06) USAGE: Product being used authentically, solving a real problem or enhancing moment
3. (0:06-0:08) BENEFIT: Close-up reaction shot or result of using product
4. (0:08-0:10) SATISFACTION: Wide pull-back showing improved life moment, subtle product visibility

CAMERA & MOVEMENT:
- Mix of shots: dolly tracking, slow push-ins, smooth handheld glides, static beauty shots
- Whip-pan or match-cut transitions between scenes
- 35mm-50mm cinematic lens feel with shallow depth of field
- Smooth, professional movement—not shaky amateur footage

SETTINGS & ENVIRONMENTS:
- Aspirational but relatable locations: modern apartment, cozy café, scenic outdoor, stylish workspace
- Golden hour or soft natural window lighting preferred
- Clean, uncluttered backgrounds that complement product
- Diverse contexts: morning routine, work productivity, evening relaxation, weekend adventure

LIGHTING & COLOR:
- Consistent warm color grade across all scenes (teal-orange or warm neutral)
- Soft, flattering natural light with gentle fill
- Magic hour/golden tones for outdoor scenes
- Cozy ambient lighting for indoor evening scenes

AESTHETIC & MOOD:
- Aspirational lifestyle content—makes viewer want this life
- Genuine moments, not posed or artificial
- Emotional storytelling: show transformation or joy from product use
- Premium brand feel without being overly polished or corporate

AUDIO CUES:
- Upbeat, modern ambient music with subtle beat
- Natural ambient sounds layered underneath (coffee shop murmur, nature, city)
- Soft product interaction sounds at key moments
- Music builds to satisfying conclusion

B-ROLL ELEMENTS:
- Detail shots: hands interacting with product, textures, materials
- Environment establishing: location context, time of day
- Reaction moments: genuine smiles, satisfied expressions
- Transition inserts: pouring coffee, opening doors, nature elements`,
};

interface ScriptGenerationOptions {
  tone?: 'casual' | 'professional' | 'enthusiastic' | 'humorous';
  targetDuration?: number;
  includeCallToAction?: boolean;
  highlightFeatures?: string[];
  additionalNotes?: string;
}

interface GeneratedScript {
  script: string;
  estimatedDuration: number;
  suggestedScenes: SceneSuggestion[];
}

class OpenAIService {
  /**
   * Analyze product image using GPT-4 Vision to extract visual details
   * SECURITY: Validates image URL before sending to OpenAI to prevent SSRF
   */
  async analyzeProductImage(imageUrl: string): Promise<VisualAnalysis | null> {
    if (!imageUrl) {
      logger.warn('No image URL provided for visual analysis');
      return null;
    }

    // SECURITY: Validate image URL before sending to external service
    const urlValidation = validateImageUrl(imageUrl);
    if (!urlValidation.valid || !urlValidation.sanitizedUrl) {
      logger.warn({ error: urlValidation.error, url: imageUrl.substring(0, 100) }, 'Invalid image URL rejected');
      return null;
    }

    const validatedImageUrl = urlValidation.sanitizedUrl;
    logger.info({ imageUrl: validatedImageUrl.substring(0, 100) }, 'Analyzing product image with GPT-4 Vision');

    const visualAnalysisPrompt = `Analyze this product image and return a detailed visual breakdown as JSON.

You must identify and describe:
1. What type of product this is
2. All visible colors (be specific, e.g., "navy blue", "rose gold")
3. Materials visible (e.g., "brushed metal", "matte plastic", "leather")
4. Overall shape and form factor
5. Approximate size relative to common objects
6. Key visual features that make this product distinctive
7. Surface texture
8. Design style (e.g., "minimalist", "vintage", "sporty")
9. A comprehensive visual description for AI video generation

Return ONLY this exact JSON structure:
{
  "productType": "What type of product this is",
  "colors": ["List of all visible colors"],
  "materials": ["List of visible materials"],
  "shape": "Description of the shape and form",
  "size": "Approximate size description",
  "keyVisualFeatures": ["List of distinctive visual features"],
  "texture": "Surface texture description",
  "style": "Design style category",
  "visualDescription": "A detailed 2-3 sentence visual description suitable for AI video generation, describing exactly how this product looks including colors, materials, shape, and any distinctive features"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0.5,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: visualAnalysisPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: validatedImageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn('No response from GPT-4 Vision');
        return null;
      }

      // Parse JSON response
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      }
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }

      const visualAnalysis = JSON.parse(jsonContent.trim()) as VisualAnalysis;
      logger.info({ productType: visualAnalysis.productType }, 'Visual analysis completed');

      return visualAnalysis;
    } catch (error) {
      logger.error({ error }, 'Failed to analyze product image with GPT-4 Vision');
      // Return null instead of throwing - visual analysis is optional enhancement
      return null;
    }
  }

  async analyzeProduct(productData: ProductData): Promise<AnalyzedProduct> {
    logger.info({ productTitle: productData.title }, 'Analyzing product with Product Breakdown GPT');

    // First, analyze the product image if available
    const imageUrl = productData.images[0];
    let visualAnalysis: VisualAnalysis | null = null;

    if (imageUrl) {
      visualAnalysis = await this.analyzeProductImage(imageUrl);
    }

    const userPrompt = `Analyze this product and return the JSON breakdown:

PRODUCT URL: ${productData.url}
PRODUCT TITLE: ${productData.title}
PRICE: ${productData.price}${productData.originalPrice ? ` (was ${productData.originalPrice})` : ''}
DESCRIPTION: ${productData.description || 'Not provided'}
SHOP NAME: ${productData.shopName || 'Not specified'}
RATING: ${productData.rating ? `${productData.rating}/5 stars` : 'Not available'}
SOLD COUNT: ${productData.soldCount || 'Not available'}
MAIN IMAGE: ${imageUrl || 'Not available'}

${visualAnalysis ? `VISUAL ANALYSIS FROM IMAGE:
- Product Type: ${visualAnalysis.productType}
- Colors: ${visualAnalysis.colors.join(', ')}
- Materials: ${visualAnalysis.materials.join(', ')}
- Shape: ${visualAnalysis.shape}
- Key Visual Features: ${visualAnalysis.keyVisualFeatures.join(', ')}
- Visual Description: ${visualAnalysis.visualDescription}
` : ''}

${productData.reviews?.length ? `CUSTOMER REVIEWS:\n${productData.reviews.slice(0, 5).map((r: ProductReview) => `- "${r.text}" (${r.rating}/5 stars)`).join('\n')}` : ''}

Return ONLY the JSON object, no other text. IMPORTANT: Include the visual analysis details in the masterProductSummary for accurate video generation.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 3000,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: PRODUCT_BREAKDOWN_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response (remove any markdown wrapping if present)
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      }
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }

      const analyzed = JSON.parse(jsonContent.trim()) as AnalyzedProduct;

      // Attach visual analysis to the result
      if (visualAnalysis) {
        analyzed.visualAnalysis = visualAnalysis;
      }

      logger.info({ productName: analyzed.productName, hasVisualAnalysis: !!visualAnalysis }, 'Product analysis completed');

      return analyzed;
    } catch (error) {
      logger.error({ error }, 'Failed to analyze product with OpenAI');
      throw new AppError(
        500,
        ErrorCodes.SCRIPT_GENERATION_FAILED,
        'Failed to analyze product. Please try again.'
      );
    }
  }

  async generateScript(
    productData: ProductData,
    videoStyle: VideoStyle,
    options: ScriptGenerationOptions = {},
    analyzedProduct?: AnalyzedProduct
  ): Promise<GeneratedScript> {
    logger.info({ videoStyle, hasAnalyzedProduct: !!analyzedProduct, hasAdditionalNotes: !!options.additionalNotes }, 'Generating Sora 2 UGC script');

    // Build the user prompt with product data
    const userPrompt = analyzedProduct
      ? this.buildSora2Prompt(analyzedProduct, videoStyle, options.additionalNotes)
      : this.buildBasicSora2Prompt(productData, videoStyle, options.additionalNotes);

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 3000,
        temperature: 0.8,
        messages: [
          {
            role: 'system',
            content: SORA2_UGC_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      logger.info({ responseLength: content.length }, 'Sora 2 script generated');

      return this.parseSora2Response(content);
    } catch (error) {
      logger.error({ error }, 'Failed to generate script with OpenAI');
      throw new AppError(
        500,
        ErrorCodes.SCRIPT_GENERATION_FAILED,
        'Failed to generate script. Please try again.'
      );
    }
  }

  private buildSora2Prompt(analyzedProduct: AnalyzedProduct, videoStyle: VideoStyle, additionalNotes?: string): string {
    const styleGuidance = STYLE_PROMPTS[videoStyle];
    const visual = analyzedProduct.visualAnalysis;

    // Build visual guidance section if visual analysis is available
    const visualGuidance = visual ? `
PRODUCT VISUAL DETAILS (MUST MATCH EXACTLY IN VIDEO):
- Product Type: ${visual.productType}
- Colors: ${visual.colors.join(', ')}
- Materials: ${visual.materials.join(', ')}
- Shape: ${visual.shape}
- Size: ${visual.size}
- Texture: ${visual.texture}
- Style: ${visual.style}
- Key Visual Features: ${visual.keyVisualFeatures.join(', ')}
- Visual Description: ${visual.visualDescription}

IMPORTANT: The product shown in the video MUST match this visual description exactly. Use the same colors, materials, shape, and features.` : '';

    // Build additional notes section if provided - enhanced for Sora 2 optimization
    const notesSection = additionalNotes ? `

═══════════════════════════════════════════════════════════════════════
USER CREATIVE DIRECTION (PRIORITY INSTRUCTIONS)
═══════════════════════════════════════════════════════════════════════

RAW USER INPUT:
"${additionalNotes}"

INTERPRETATION & APPLICATION GUIDE:
Analyze the user's notes above and apply them according to these categories:

1. TONE & ENERGY
   - If user mentions mood/energy (e.g., "energetic", "calm", "funny", "serious"):
     → Adjust spoken script tone, pacing, and creator expression
     → Match background music mood and tempo
     → Align visual energy (fast cuts vs. smooth glides)

2. FEATURE EMPHASIS
   - If user highlights specific features or benefits:
     → Make these the CENTRAL focus of the BODY scene (0:03-0:08)
     → Ensure text overlays call out these specific features
     → Craft spoken script to emphasize these points over generic benefits

3. TARGET AUDIENCE CUES
   - If user specifies audience (e.g., "for moms", "targeting students"):
     → Adjust creator persona to resonate with this demographic
     → Use relatable scenarios and language for this audience
     → Choose settings/environments that appeal to this group

4. VISUAL STYLE REQUESTS
   - If user requests specific visuals (colors, settings, lighting):
     → Override default style guidance with user preferences
     → Maintain product accuracy while applying visual customization
     → Ensure consistency across all scenes

5. HOOK/SCRIPT IDEAS
   - If user provides hook ideas or script phrases:
     → Incorporate these VERBATIM or closely adapted in the HOOK scene
     → Build the rest of the script to support user's creative vision
     → Maintain natural flow while honoring user's words

6. CTA PREFERENCES
   - If user specifies CTA style (urgency, scarcity, trust):
     → Apply requested approach to final CTA scene (0:08-0:10)
     → Adjust spoken CTA and text overlay accordingly
     → Examples: "limited stock" → scarcity angle, "trusted by thousands" → social proof

7. CREATOR PERSONA
   - If user requests specific creator type (age, gender, vibe):
     → Adjust subject description in visual prompts
     → Match speaking style and energy to requested persona
     → Ensure authenticity markers align with persona

8. EXCLUSIONS & CONSTRAINTS
   - If user says "don't mention X" or "avoid Y":
     → STRICTLY exclude these elements from all scenes
     → Find alternative angles that achieve similar impact

APPLICATION PRIORITY:
1. Product accuracy (NEVER compromise)
2. User's explicit instructions (HIGHEST creative priority)
3. Video style template (BASELINE, can be overridden)
4. Default UGC best practices (FALLBACK for unspecified elements)

CONVERSION OPTIMIZATION:
Even when applying user customizations, maintain these conversion anchors:
- Clear product visibility in every scene
- Authentic UGC feel (not corporate/polished)
- Strong hook that stops the scroll
- Benefit-focused messaging
- Clear CTA pointing to cart area
═══════════════════════════════════════════════════════════════════════` : '';

    return `Generate a Sora 2-ready TikTok Shop UGC video prompt for this product:

PRODUCT NAME: ${analyzedProduct.productName}

PRODUCT DESCRIPTION:
${analyzedProduct.productDescription}
${visualGuidance}

KEY FEATURES (use only these, do not invent):
${analyzedProduct.keyFeatures.map(f => `• ${f}`).join('\n')}

KEY BENEFITS (use only these, do not invent):
${analyzedProduct.keyBenefits.map(b => `• ${b}`).join('\n')}

TARGET CUSTOMER:
${analyzedProduct.targetCustomer}

PROBLEMS SOLVED:
${analyzedProduct.problemsSolved.map(p => `• ${p}`).join('\n')}

UNIQUE SELLING POINTS:
${analyzedProduct.uniqueSellingPoints.map(u => `• ${u}`).join('\n')}

PRODUCT IMAGE URL: ${analyzedProduct.imageUrl}

${styleGuidance}
${notesSection}

Generate a complete 10-second TikTok UGC video prompt optimized for Sora 2 generation. The video will use the product image as a reference, so ensure visual descriptions match the actual product appearance. Return ONLY valid JSON.`;
  }

  private buildBasicSora2Prompt(productData: ProductData, videoStyle: VideoStyle, additionalNotes?: string): string {
    const styleGuidance = STYLE_PROMPTS[videoStyle];

    // Build additional notes section if provided - enhanced for Sora 2 optimization
    const notesSection = additionalNotes ? `

═══════════════════════════════════════════════════════════════════════
USER CREATIVE DIRECTION (PRIORITY INSTRUCTIONS)
═══════════════════════════════════════════════════════════════════════

RAW USER INPUT:
"${additionalNotes}"

INTERPRETATION & APPLICATION GUIDE:
Analyze the user's notes above and apply them according to these categories:

1. TONE & ENERGY
   - If user mentions mood/energy (e.g., "energetic", "calm", "funny", "serious"):
     → Adjust spoken script tone, pacing, and creator expression
     → Match background music mood and tempo
     → Align visual energy (fast cuts vs. smooth glides)

2. FEATURE EMPHASIS
   - If user highlights specific features or benefits:
     → Make these the CENTRAL focus of the BODY scene (0:03-0:08)
     → Ensure text overlays call out these specific features
     → Craft spoken script to emphasize these points over generic benefits

3. TARGET AUDIENCE CUES
   - If user specifies audience (e.g., "for moms", "targeting students"):
     → Adjust creator persona to resonate with this demographic
     → Use relatable scenarios and language for this audience
     → Choose settings/environments that appeal to this group

4. VISUAL STYLE REQUESTS
   - If user requests specific visuals (colors, settings, lighting):
     → Override default style guidance with user preferences
     → Maintain product accuracy while applying visual customization
     → Ensure consistency across all scenes

5. HOOK/SCRIPT IDEAS
   - If user provides hook ideas or script phrases:
     → Incorporate these VERBATIM or closely adapted in the HOOK scene
     → Build the rest of the script to support user's creative vision
     → Maintain natural flow while honoring user's words

6. CTA PREFERENCES
   - If user specifies CTA style (urgency, scarcity, trust):
     → Apply requested approach to final CTA scene (0:08-0:10)
     → Adjust spoken CTA and text overlay accordingly
     → Examples: "limited stock" → scarcity angle, "trusted by thousands" → social proof

7. CREATOR PERSONA
   - If user requests specific creator type (age, gender, vibe):
     → Adjust subject description in visual prompts
     → Match speaking style and energy to requested persona
     → Ensure authenticity markers align with persona

8. EXCLUSIONS & CONSTRAINTS
   - If user says "don't mention X" or "avoid Y":
     → STRICTLY exclude these elements from all scenes
     → Find alternative angles that achieve similar impact

APPLICATION PRIORITY:
1. Product accuracy (NEVER compromise)
2. User's explicit instructions (HIGHEST creative priority)
3. Video style template (BASELINE, can be overridden)
4. Default UGC best practices (FALLBACK for unspecified elements)

CONVERSION OPTIMIZATION:
Even when applying user customizations, maintain these conversion anchors:
- Clear product visibility in every scene
- Authentic UGC feel (not corporate/polished)
- Strong hook that stops the scroll
- Benefit-focused messaging
- Clear CTA pointing to cart area
═══════════════════════════════════════════════════════════════════════` : '';

    return `Generate a Sora 2-ready TikTok Shop UGC video prompt for this product:

PRODUCT TITLE: ${productData.title}
DESCRIPTION: ${productData.description || 'Not provided'}
SHOP: ${productData.shopName || 'Not specified'}
PRODUCT IMAGE URL: ${productData.images[0] || 'Not available'}

${styleGuidance}
${notesSection}

Generate a complete 10-second TikTok UGC video prompt optimized for Sora 2 generation. Return ONLY valid JSON.`;
  }

  private parseSora2Response(content: string): GeneratedScript {
    // Clean up any markdown wrapping
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    }
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }

    try {
      const parsed = JSON.parse(jsonContent.trim());

      // Extract scenes into our format
      const suggestedScenes: SceneSuggestion[] = (parsed.scenes || []).map((scene: {
        timestamp?: string;
        visualDescription?: string;
        spokenScript?: string;
      }) => ({
        timestamp: scene.timestamp || '',
        description: scene.spokenScript || '',
        visualSuggestion: scene.visualDescription || '',
      }));

      // Create a formatted script from the parsed data
      const formattedScript = this.formatSora2Script(parsed);

      return {
        script: formattedScript,
        estimatedDuration: 10,
        suggestedScenes,
      };
    } catch {
      // Fallback: return raw content as script
      logger.warn('Failed to parse Sora 2 JSON response, using raw content');
      return {
        script: content,
        estimatedDuration: 10,
        suggestedScenes: [],
      };
    }
  }

  private formatSora2Script(parsed: {
    videoPrompt?: string;
    masterSora2Prompt?: string;
    scenes?: Array<{
      timestamp?: string;
      type?: string;
      visualDescription?: string;
      textOverlay?: string;
      spokenScript?: string;
      cameraMovement?: string;
    }>;
  }): string {
    let script = '';

    // Add master prompt at the top
    if (parsed.masterSora2Prompt) {
      script += `MASTER SORA 2 PROMPT:\n${parsed.masterSora2Prompt}\n\n`;
    }

    script += '---SCRIPT START---\n\n';

    // Format each scene
    if (parsed.scenes && parsed.scenes.length > 0) {
      for (const scene of parsed.scenes) {
        script += `[${scene.timestamp || ''}] ${scene.type || 'SCENE'}\n`;
        script += `Script: "${scene.spokenScript || ''}"\n`;
        script += `Visual: [${scene.visualDescription || ''}]\n`;
        if (scene.textOverlay) {
          script += `Text Overlay: "${scene.textOverlay}"\n`;
        }
        if (scene.cameraMovement) {
          script += `Camera: ${scene.cameraMovement}\n`;
        }
        script += '\n';
      }
    }

    script += '---SCRIPT END---\n\n';
    script += 'ESTIMATED DURATION: 10 seconds';

    return script;
  }

}

export const openaiService = new OpenAIService();
