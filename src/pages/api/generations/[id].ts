import type { APIRoute } from "astro";
import { z } from "zod";
import type { GetGenerationDetailResponseDTO } from "../../../types";
import { createGenerationService } from "../../../lib/generation.service.js";
import { DEFAULT_USER_ID } from "../../../db/supabase.client";

/**
 * GET /api/generations/{id}
 *
 * Endpoint for retrieving detailed information about a single generation by its ID.
 * Returns full generation metadata (excluding user_id for security) and all associated flashcards.
 *
 * Path parameters:
 * - id (number) - Generation ID to retrieve (must be a positive integer)
 *
 * @param params - Route parameters containing the generation ID
 * @param locals - Request context including Supabase client
 * @returns JSON response with generation detail data and associated flashcards
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Database connection check
    if (!locals.supabase) {
      return new Response(JSON.stringify({ error: "Database connection not available" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract and validate id parameter from URL
    const idParam = params.id;

    if (!idParam) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: "Generation ID is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate id parameter using Zod
    // Transform string to number and validate it's a positive integer
    const idSchema = z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int("ID must be an integer").positive("ID must be a positive integer"));

    const validationResult = idSchema.safeParse(idParam);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map((err) => err.message).join(", ");

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

    const generationId = validationResult.data;

    // Create generation service and fetch generation with flashcards
    const generationService = createGenerationService(locals.supabase);
    const result: GetGenerationDetailResponseDTO = await generationService.getGenerationById(
      generationId,
      DEFAULT_USER_ID
    );

    // Return successful response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Generation GET by ID endpoint error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check if it's a "not found" error
      if (error.message.includes("not found") || error.message.includes("Generation with ID")) {
        return new Response(
          JSON.stringify({
            error: "Not found",
            message: error.message,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if it's a database error
      if (
        error.message.includes("Failed to fetch generation") ||
        error.message.includes("Failed to fetch flashcards")
      ) {
        return new Response(
          JSON.stringify({
            error: "Internal server error",
            message: "Failed to retrieve generation from database",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Generic error response
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
