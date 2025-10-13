import type { APIRoute } from "astro";
import { z } from "zod";
import type { CreateGenerationCommand, CreateGenerationResponseDTO } from "../../types";
import { createGenerationService } from "../../lib/generation.service.js";
import { DEFAULT_USER_ID } from "../../db/supabase.client";

/**
 * POST /api/generations
 *
 * Endpoint for initiating flashcard generation process using AI.
 * Validates input text and returns generated flashcard proposals.
 *
 * @param request - HTTP request containing source_text in body
 * @returns JSON response with generation metadata and flashcard proposals
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Database connection check
    if (!locals.supabase) {
      return new Response(JSON.stringify({ error: "Database connection not available" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    let requestBody: CreateGenerationCommand;
    try {
      const rawBody = await request.json();
      requestBody = rawBody;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate input using Zod schema
    const validationSchema = z.object({
      source_text: z
        .string()
        .min(1000, "Source text must be at least 1000 characters long")
        .max(10000, "Source text must not exceed 10000 characters"),
    });

    const validationResult = validationSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: errorMessages,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { source_text } = validationResult.data;

    // Create generation service and process request
    const generationService = createGenerationService(locals.supabase);
    const result = await generationService.generateFlashcards(source_text, DEFAULT_USER_ID);

    // Return successful response
    const response: CreateGenerationResponseDTO = {
      generation_id: result.generation_id,
      flashcards_proposals: result.flashcards_proposals,
      generated_count: result.generated_count,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Generation endpoint error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "An unexpected error occurred while processing your request",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
