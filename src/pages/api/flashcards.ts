import type { APIRoute } from "astro";
import { z } from "zod";
import type { CreateFlashcardsRequestDTO, CreateFlashcardsResponseDTO } from "../../types";
import { createFlashcardService } from "../../lib/flashcard.service.js";
import { DEFAULT_USER_ID } from "../../db/supabase.client";

/**
 * POST /api/flashcards
 *
 * Endpoint for creating one or multiple flashcards.
 * Supports both manually created and AI-generated flashcards with proper validation.
 *
 * @param request - HTTP request containing flashcards array in body
 * @returns JSON response with created flashcards data
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
    let requestBody: CreateFlashcardsRequestDTO;
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
    const flashcardSchema = z.object({
      front: z.string().min(1, "Front text is required").max(200, "Front text cannot exceed 200 characters"),
      back: z.string().min(1, "Back text is required").max(500, "Back text cannot exceed 500 characters"),
      source: z.enum(["ai-full", "ai-edited", "manual"], {
        errorMap: () => ({ message: "Source must be one of: ai-full, ai-edited, manual" }),
      }),
      generation_id: z.number().int().positive("Generation ID must be a positive integer").nullable().optional(),
    });

    const requestSchema = z.object({
      flashcards: z
        .array(flashcardSchema)
        .min(1, "At least one flashcard is required")
        .max(100, "Cannot create more than 100 flashcards at once"),
    });

    const validationResult = requestSchema.safeParse(requestBody);

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

    const { flashcards } = validationResult.data;

    // Additional business logic validation for generation_id
    for (let i = 0; i < flashcards.length; i++) {
      const flashcard = flashcards[i];
      const index = i + 1;

      // Validate generation_id based on source
      if (flashcard.source === "manual" && flashcard.generation_id !== null) {
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: `Flashcard ${index}: generation_id must be null for manual flashcards`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if ((flashcard.source === "ai-full" || flashcard.source === "ai-edited") && flashcard.generation_id === null) {
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: `Flashcard ${index}: generation_id is required for AI-generated flashcards`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create flashcard service and process request
    const flashcardService = createFlashcardService(locals.supabase);
    const result = await flashcardService.createFlashcards(flashcards, DEFAULT_USER_ID);

    // Return successful response
    const response: CreateFlashcardsResponseDTO = {
      flashcards: result.flashcards,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Flashcards endpoint error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check if it's a validation error from the service
      if (error.message.includes("Generation") || error.message.includes("Flashcard")) {
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: error.message,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

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
