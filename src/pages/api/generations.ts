import type { APIRoute } from "astro";
import { z } from "zod";
import type { CreateGenerationCommand, CreateGenerationResponseDTO, GetGenerationsResponseDTO } from "../../types";
import { createGenerationService } from "../../lib/generation.service.js";
import { DEFAULT_USER_ID } from "../../db/supabase.client";

/**
 * GET /api/generations
 *
 * Endpoint for retrieving a paginated, sorted list of generation records.
 * Supports sorting by various fields and pagination.
 *
 * Query parameters:
 * - page (number, default: 1) - Page number
 * - limit (number, default: 10) - Results per page (max: 100)
 * - sort (string, default: 'created_at') - Field to sort by
 * - order ('asc' | 'desc', default: 'desc') - Sort direction
 *
 * @param request - HTTP request with optional query parameters
 * @returns JSON response with generations data and pagination info
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Database connection check
    if (!locals.supabase) {
      return new Response(JSON.stringify({ error: "Database connection not available" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Define allowed sort fields
    const allowedSortFields = ["created_at", "updated_at", "id", "generation_duration", "generated_count"];

    // Validate query parameters using Zod
    const querySchema = z.object({
      page: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1))
        .pipe(z.number().int().positive("Page must be a positive integer")),
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 10))
        .pipe(z.number().int().positive("Limit must be a positive integer").max(100, "Limit cannot exceed 100")),
      sort: z
        .string()
        .optional()
        .default("created_at")
        .refine((val) => allowedSortFields.includes(val), {
          message: `Sort field must be one of: ${allowedSortFields.join(", ")}`,
        }),
      order: z
        .enum(["asc", "desc"], {
          errorMap: () => ({ message: "Order must be 'asc' or 'desc'" }),
        })
        .optional()
        .default("desc"),
    });

    const validationResult = querySchema.safeParse(queryParams);

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

    const { page, limit, sort, order } = validationResult.data;

    // Create generation service and fetch generations
    const generationService = createGenerationService(locals.supabase);
    const result: GetGenerationsResponseDTO = await generationService.getGenerations(
      DEFAULT_USER_ID,
      page,
      limit,
      sort,
      order
    );

    // Return successful response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Generations GET endpoint error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check if it's a database error from the service
      if (error.message.includes("Failed to fetch generations")) {
        return new Response(
          JSON.stringify({
            error: "Internal server error",
            message: "Failed to retrieve generations from database",
          }),
          {
            status: 500,
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
