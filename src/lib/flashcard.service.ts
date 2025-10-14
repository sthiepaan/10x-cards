import type { SupabaseClient } from "../db/supabase.client";
import type { CreateFlashcardCommand, CreateFlashcardsResponseDTO, FlashcardInsertEntity } from "../types";

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
