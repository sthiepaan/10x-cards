import type { SupabaseClient } from "../db/supabase.client";
import type {
  CreateFlashcardCommand,
  CreateFlashcardsResponseDTO,
  FlashcardDetailDTO,
  FlashcardInsertEntity,
  GetFlashcardsResponseDTO,
  UpdateFlashcardCommand,
  UpdateFlashcardResponseDTO,
} from "../types";

/**
 * Service for handling flashcard operations.
 * Manages creation, validation, and database operations for flashcards.
 */
export class FlashcardService {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Creates multiple flashcards in a batch operation.
   * Validates business rules and ensures data integrity.
   *
   * @param flashcards - Array of flashcard commands to create
   * @param userId - Authenticated user ID
   * @returns Promise with created flashcards data
   */
  async createFlashcards(flashcards: CreateFlashcardCommand[], userId: string): Promise<CreateFlashcardsResponseDTO> {
    // Validate business rules
    await this.validateFlashcards(flashcards, userId);

    // Prepare data for batch insert
    const flashcardData: FlashcardInsertEntity[] = flashcards.map((flashcard) => ({
      front: flashcard.front,
      back: flashcard.back,
      source: flashcard.source,
      generation_id: flashcard.generation_id,
      user_id: userId,
    }));

    // Perform batch insert
    const { data: createdFlashcards, error } = await this.supabase
      .from("flashcards")
      .insert(flashcardData)
      .select("id, front, back, source, generation_id");

    if (error) {
      throw new Error(`Failed to create flashcards: ${error.message}`);
    }

    if (!createdFlashcards) {
      throw new Error("No flashcards were created");
    }

    return {
      flashcards: createdFlashcards,
    };
  }

  /**
   * Validates flashcard data against business rules.
   *
   * @param flashcards - Array of flashcard commands to validate
   * @param userId - User ID for authorization checks
   * @throws Error if validation fails
   */
  private async validateFlashcards(flashcards: CreateFlashcardCommand[], userId: string): Promise<void> {
    // Check if flashcards array is not empty
    if (!flashcards || flashcards.length === 0) {
      throw new Error("Flashcards array cannot be empty");
    }

    // Validate each flashcard
    for (let i = 0; i < flashcards.length; i++) {
      const flashcard = flashcards[i];
      const index = i + 1;

      // Validate required fields
      if (!flashcard.front || !flashcard.back || !flashcard.source) {
        throw new Error(`Flashcard ${index}: All fields (front, back, source) are required`);
      }

      // Validate field lengths
      if (flashcard.front.length > 200) {
        throw new Error(`Flashcard ${index}: Front text cannot exceed 200 characters`);
      }

      if (flashcard.back.length > 500) {
        throw new Error(`Flashcard ${index}: Back text cannot exceed 500 characters`);
      }

      // Validate source values
      const validSources = ["ai-full", "ai-edited", "manual"];
      if (!validSources.includes(flashcard.source)) {
        throw new Error(`Flashcard ${index}: Source must be one of: ${validSources.join(", ")}`);
      }

      // Validate generation_id based on source
      if (flashcard.source === "manual" && flashcard.generation_id !== null) {
        throw new Error(`Flashcard ${index}: generation_id must be null for manual flashcards`);
      }

      if (
        (flashcard.source === "ai-full" || flashcard.source === "ai-edited") &&
        (flashcard.generation_id === null || flashcard.generation_id === undefined)
      ) {
        throw new Error(`Flashcard ${index}: generation_id is required for AI-generated flashcards`);
      }

      // If generation_id is provided, validate it exists and belongs to user
      if (flashcard.generation_id !== null && flashcard.generation_id !== undefined) {
        await this.validateGenerationOwnership(flashcard.generation_id, userId);
      }
    }
  }

  /**
   * Retrieves a paginated, filtered, and sorted list of flashcards for a user.
   * Supports filtering by source and generation_id, sorting by various fields,
   * and pagination with total count.
   *
   * @param userId - Authenticated user ID
   * @param page - Page number (default: 1)
   * @param limit - Number of results per page (default: 10)
   * @param sort - Field to sort by (default: 'created_at')
   * @param order - Sort direction 'asc' or 'desc' (default: 'desc')
   * @param source - Optional filter by source ('ai-full', 'ai-edited', 'manual')
   * @param generationId - Optional filter by generation ID
   * @returns Promise with paginated flashcards data
   * @throws Error if database query fails
   */
  async getFlashcards(
    userId: string,
    page = 1,
    limit = 10,
    sort = "created_at",
    order: "asc" | "desc" = "desc",
    source?: string,
    generationId?: number
  ): Promise<GetFlashcardsResponseDTO> {
    // Build base query with user filter
    let query = this.supabase
      .from("flashcards")
      .select("id, front, back, source, created_at, updated_at", { count: "exact" })
      .eq("user_id", userId);

    // Apply optional filters
    if (source) {
      query = query.eq("source", source);
    }

    if (generationId !== undefined) {
      query = query.eq("generation_id", generationId);
    }

    // Apply sorting
    query = query.order(sort, { ascending: order === "asc" });

    // Apply pagination
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    // Execute query
    const { data: flashcards, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch flashcards: ${error.message}`);
    }

    // Calculate total pages and ensure count is not null
    const total = count ?? 0;

    return {
      data: flashcards || [],
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  /**
   * Retrieves a single flashcard by ID for a specific user.
   * Verifies that the flashcard exists and belongs to the authenticated user.
   * Returns flashcard data in FlashcardDetailDTO format (excluding user_id).
   *
   * @param flashcardId - ID of the flashcard to retrieve
   * @param userId - Authenticated user ID for authorization
   * @returns Promise with flashcard detail data
   * @throws Error if flashcard doesn't exist or doesn't belong to user
   */
  async getFlashcardById(flashcardId: number, userId: string): Promise<FlashcardDetailDTO> {
    // Build query with filters for both id and user_id
    const { data: flashcard, error } = await this.supabase
      .from("flashcards")
      .select("id, front, back, source, created_at, updated_at, generation_id")
      .eq("id", flashcardId)
      .eq("user_id", userId)
      .single();

    // Handle database errors
    if (error) {
      // Check if it's a "not found" error (PGRST116 is Supabase's code for no rows returned)
      if (error.code === "PGRST116" || error.message.includes("No rows returned")) {
        throw new Error(`Flashcard with ID ${flashcardId} not found`);
      }
      throw new Error(`Failed to fetch flashcard: ${error.message}`);
    }

    // Additional check: if data is null, treat as not found
    if (!flashcard) {
      throw new Error(`Flashcard with ID ${flashcardId} not found`);
    }

    // Return flashcard data (user_id is already excluded from select)
    return flashcard;
  }

  /**
   * Updates an existing flashcard by ID.
   * Verifies that the flashcard exists and belongs to the authenticated user,
   * validates update data, and performs the update operation.
   *
   * @param flashcardId - ID of the flashcard to update
   * @param userId - Authenticated user ID for authorization
   * @param updateData - Data to update (front, back, source - all optional but at least one required)
   * @returns Promise with updated flashcard data in FlashcardDetailDTO format
   * @throws Error if flashcard doesn't exist, doesn't belong to user, or validation fails
   */
  async updateFlashcardById(
    flashcardId: number,
    userId: string,
    updateData: UpdateFlashcardCommand
  ): Promise<UpdateFlashcardResponseDTO> {
    // Verify flashcard exists and belongs to user
    await this.getFlashcardById(flashcardId, userId);

    // Validate update data
    this.validateUpdateData(updateData);

    // Prepare update payload (only include fields that are provided)
    const updatePayload: Record<string, string> = {};
    if (updateData.front !== undefined) {
      updatePayload.front = updateData.front;
    }
    if (updateData.back !== undefined) {
      updatePayload.back = updateData.back;
    }
    if (updateData.source !== undefined) {
      updatePayload.source = updateData.source;
    }

    // Perform update with filtering by id and user_id
    const { data: updatedFlashcard, error } = await this.supabase
      .from("flashcards")
      .update(updatePayload)
      .eq("id", flashcardId)
      .eq("user_id", userId)
      .select("id, front, back, source, created_at, updated_at, generation_id")
      .single();

    // Handle database errors
    if (error) {
      throw new Error(`Failed to update flashcard: ${error.message}`);
    }

    // Additional check: if data is null, treat as not found
    if (!updatedFlashcard) {
      throw new Error(`Flashcard with ID ${flashcardId} not found`);
    }

    // Return updated flashcard data (user_id is already excluded from select)
    return updatedFlashcard;
  }

  /**
   * Validates update data for flashcard updates.
   * Ensures at least one field is provided and validates field constraints.
   *
   * @param updateData - Update data to validate
   * @throws Error if validation fails
   */
  private validateUpdateData(updateData: UpdateFlashcardCommand): void {
    // Check that at least one field is provided
    if (
      updateData.front === undefined &&
      updateData.back === undefined &&
      updateData.source === undefined
    ) {
      throw new Error("At least one field (front, back, source) must be provided for update");
    }

    // Validate front field length if provided
    if (updateData.front !== undefined) {
      if (updateData.front.length > 200) {
        throw new Error("Front text cannot exceed 200 characters");
      }
    }

    // Validate back field length if provided
    if (updateData.back !== undefined) {
      if (updateData.back.length > 500) {
        throw new Error("Back text cannot exceed 500 characters");
      }
    }

    // Validate source value if provided
    if (updateData.source !== undefined) {
      const validSources = ["ai-edited", "manual"];
      if (!validSources.includes(updateData.source)) {
        throw new Error(`Source must be one of: ${validSources.join(", ")}`);
      }
    }
  }

  /**
   * Validates that a generation exists and belongs to the user.
   *
   * @param generationId - Generation ID to validate
   * @param userId - User ID to check ownership
   * @throws Error if generation doesn't exist or doesn't belong to user
   */
  private async validateGenerationOwnership(generationId: number, userId: string): Promise<void> {
    const { data: generation, error } = await this.supabase
      .from("generations")
      .select("id, user_id")
      .eq("id", generationId)
      .single();

    if (error || !generation) {
      throw new Error(`Generation with ID ${generationId} not found`);
    }

    if (generation.user_id !== userId) {
      throw new Error(`Generation ${generationId} does not belong to the current user`);
    }
  }
}

/**
 * Factory function to create a FlashcardService instance.
 *
 * @param supabase - Supabase client instance
 * @returns New FlashcardService instance
 */
export function createFlashcardService(supabase: SupabaseClient): FlashcardService {
  return new FlashcardService(supabase);
}
