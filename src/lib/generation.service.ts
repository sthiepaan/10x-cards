import { createHash } from "crypto";
import type { SupabaseClient } from "../db/supabase.client";
import type { GenerationInsertEntity, GenerationErrorLogEntity, FlashcardProposalDTO } from "../types";

/**
 * Service for handling flashcard generation using AI.
 * Manages the complete flow from text input to database storage.
 */
export class GenerationService {
  private readonly supabase: SupabaseClient;
  private readonly AI_MODEL = "gpt-4o-mini"; // Default model for development
  private readonly AI_TIMEOUT = 60000; // 60 seconds timeout

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Generates flashcards from source text using AI service.
   *
   * @param sourceText - Input text to generate flashcards from (1000-10000 chars)
   * @param userId - Authenticated user ID
   * @returns Promise with generation results
   */
  async generateFlashcards(
    sourceText: string,
    userId: string
  ): Promise<{
    generation_id: number;
    flashcards_proposals: FlashcardProposalDTO[];
    generated_count: number;
  }> {
    const startTime = Date.now();
    const sourceTextHash = this.generateTextHash(sourceText);
    const sourceTextLength = sourceText.length;

    try {
      // Call AI service to generate flashcard proposals
      const aiProposals = await this.callAIService(sourceText);

      // Calculate generation duration
      const generationDuration = Date.now() - startTime;

      // Save generation metadata to database
      const generationData: GenerationInsertEntity = {
        user_id: userId,
        model: this.AI_MODEL,
        generated_count: aiProposals.length,
        generation_duration: generationDuration,
        source_text_hash: sourceTextHash,
        source_text_length: sourceTextLength,
        accepted_edited_count: null,
        accepted_unedited_count: null,
      };

      const { data: generation, error: generationError } = await this.supabase
        .from("generations")
        .insert(generationData)
        .select("id")
        .single();

      if (generationError || !generation) {
        throw new Error(`Failed to save generation metadata: ${generationError?.message}`);
      }

      return {
        generation_id: generation.id,
        flashcards_proposals: aiProposals,
        generated_count: aiProposals.length,
      };
    } catch (error) {
      // Log error to generation_error_logs table
      await this.logGenerationError(error as Error, sourceTextHash, sourceTextLength, userId);

      // Re-throw to be handled by endpoint
      throw error;
    }
  }

  /**
   * Calls external AI service to generate flashcard proposals.
   * Currently uses mock data for development.
   *
   * @param sourceText - Input text for generation
   * @returns Promise with generated flashcard proposals
   */
  private async callAIService(_sourceText: string): Promise<FlashcardProposalDTO[]> {
    // TODO: Replace with actual AI service integration
    // For now, return mock data based on the plan requirements

    // Simulate AI processing time
    await new Promise((resolve) => setTimeout(() => resolve(_sourceText), 1000));

    // Mock flashcard proposals
    const mockProposals: FlashcardProposalDTO[] = [
      {
        front: "What is the main topic discussed in the provided text?",
        back: "The main topic covers the key concepts and ideas presented in the source material.",
        source: "ai-full",
      },
      {
        front: "What are the key points mentioned in the text?",
        back: "The key points include the primary arguments, supporting evidence, and conclusions drawn from the analysis.",
        source: "ai-full",
      },
      {
        front: "How does the text structure its arguments?",
        back: "The text structures its arguments through logical progression, evidence presentation, and conclusion synthesis.",
        source: "ai-full",
      },
      {
        front: "What implications can be drawn from the content?",
        back: "The implications suggest potential applications, future considerations, and broader impact of the discussed concepts.",
        source: "ai-full",
      },
      {
        front: "What are the main takeaways from this material?",
        back: "The main takeaways include the core insights, practical applications, and key learning points for further study.",
        source: "ai-full",
      },
    ];

    return mockProposals;
  }

  /**
   * Logs generation errors to the database for monitoring and debugging.
   *
   * @param error - The error that occurred
   * @param sourceTextHash - Hash of the source text
   * @param sourceTextLength - Length of the source text
   * @param userId - User ID who initiated the generation
   */
  private async logGenerationError(
    error: Error,
    sourceTextHash: string,
    sourceTextLength: number,
    userId: string
  ): Promise<void> {
    try {
      const errorLog: Omit<GenerationErrorLogEntity, "id" | "created_at"> = {
        user_id: userId,
        model: this.AI_MODEL,
        error_code: error.name || "UNKNOWN_ERROR",
        error_message: error.message,
        source_text_hash: sourceTextHash,
        source_text_length: sourceTextLength,
      };

      await this.supabase.from("generation_error_logs").insert(errorLog);
    } catch (logError) {
      // Don't throw here to avoid masking the original error
      // eslint-disable-next-line no-console
      console.error("Failed to log generation error:", logError);
    }
  }

  /**
   * Generates a hash of the source text for tracking and deduplication.
   *
   * @param text - Text to hash
   * @returns MD5 hash of the text
   */
  private generateTextHash(text: string): string {
    return createHash("md5").update(text).digest("hex");
  }
}

/**
 * Factory function to create a GenerationService instance.
 *
 * @param supabase - Supabase client instance
 * @returns New GenerationService instance
 */
export function createGenerationService(supabase: SupabaseClient): GenerationService {
  return new GenerationService(supabase);
}
