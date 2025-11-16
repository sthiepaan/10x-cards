import type { APIRoute } from "astro";
import { z } from "zod";
import type { FlashcardDetailDTO, UpdateFlashcardCommand, UpdateFlashcardResponseDTO } from "../../../types";
import { createFlashcardService } from "../../../lib/flashcard.service.js";
import { DEFAULT_USER_ID } from "../../../db/supabase.client";

/**
 * GET /api/flashcards/{id}
 *
 * Endpoint for retrieving detailed information about a single flashcard by its ID.
 * Returns full flashcard data excluding user_id for security reasons.
 *
 * Path parameters:
 * - id (number) - Flashcard ID to retrieve (must be a positive integer)
 *
 * @param params - Route parameters containing the flashcard ID
 * @param locals - Request context including Supabase client
 * @returns JSON response with flashcard detail data
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
          details: "Flashcard ID is required",
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

    const flashcardId = validationResult.data;

    // Create flashcard service and fetch flashcard
    const flashcardService = createFlashcardService(locals.supabase);
    const flashcard: FlashcardDetailDTO = await flashcardService.getFlashcardById(flashcardId, DEFAULT_USER_ID);

    // Return successful response
    return new Response(JSON.stringify(flashcard), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Flashcard GET by ID endpoint error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check if it's a "not found" error
      if (error.message.includes("not found") || error.message.includes("Flashcard with ID")) {
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
      if (error.message.includes("Failed to fetch flashcard")) {
        return new Response(
          JSON.stringify({
            error: "Internal server error",
            message: "Failed to retrieve flashcard from database",
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

/**
 * PUT /api/flashcards/{id}
 *
 * Endpoint for updating an existing flashcard by its ID.
 * Allows modification of front, back, and source fields.
 * Returns updated flashcard data in FlashcardDetailDTO format.
 *
 * Path parameters:
 * - id (number) - Flashcard ID to update (must be a positive integer)
 *
 * Request body (JSON, at least one field required):
 * - front (string, optional) - Front text of the flashcard (max 200 characters)
 * - back (string, optional) - Back text of the flashcard (max 500 characters)
 * - source (string, optional) - Source of the flashcard ('ai-edited' or 'manual')
 *
 * @param params - Route parameters containing the flashcard ID
 * @param request - Request object containing the update data
 * @param locals - Request context including Supabase client
 * @returns JSON response with updated flashcard detail data
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
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
          details: "Flashcard ID is required",
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

    const idValidationResult = idSchema.safeParse(idParam);

    if (!idValidationResult.success) {
      const errorMessages = idValidationResult.error.errors.map((err) => err.message).join(", ");

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

    const flashcardId = idValidationResult.data;

    // Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: "Invalid JSON in request body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate request body using Zod
    // Schema for UpdateFlashcardCommand with optional fields
    const updateFlashcardSchema = z
      .object({
        front: z.string().max(200, "Front text cannot exceed 200 characters").optional(),
        back: z.string().max(500, "Back text cannot exceed 500 characters").optional(),
        source: z
          .enum(["ai-edited", "manual"], {
            errorMap: () => ({ message: "Source must be one of: ai-edited, manual" }),
          })
          .optional(),
      })
      .refine((data) => data.front !== undefined || data.back !== undefined || data.source !== undefined, {
        message: "At least one field (front, back, source) must be provided for update",
      });

    const bodyValidationResult = updateFlashcardSchema.safeParse(requestBody);

    if (!bodyValidationResult.success) {
      const errorMessages = bodyValidationResult.error.errors.map((err) => err.message).join(", ");

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

    const updateData: UpdateFlashcardCommand = bodyValidationResult.data;

    // Create flashcard service and update flashcard
    const flashcardService = createFlashcardService(locals.supabase);
    const updatedFlashcard: UpdateFlashcardResponseDTO = await flashcardService.updateFlashcardById(
      flashcardId,
      DEFAULT_USER_ID,
      updateData
    );

    // Return successful response
    return new Response(JSON.stringify(updatedFlashcard), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Flashcard PUT endpoint error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check if it's a "not found" error
      if (error.message.includes("not found") || error.message.includes("Flashcard with ID")) {
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

      // Check if it's a validation error
      if (
        error.message.includes("must be provided") ||
        error.message.includes("cannot exceed") ||
        error.message.includes("must be one of")
      ) {
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

      // Check if it's a database error
      if (error.message.includes("Failed to update flashcard") || error.message.includes("Failed to fetch flashcard")) {
        return new Response(
          JSON.stringify({
            error: "Internal server error",
            message: "Failed to update flashcard in database",
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
