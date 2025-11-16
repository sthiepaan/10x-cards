import type { Tables, TablesInsert, TablesUpdate } from "./db/database.types";

/**
 * Entity aliases derived directly from generated Supabase types.
 * Keep these as the single source of truth to ensure DTOs stay aligned with DB.
 */
export type FlashcardEntity = Tables<"flashcards">;
export type FlashcardInsertEntity = TablesInsert<"flashcards">;
export type FlashcardUpdateEntity = TablesUpdate<"flashcards">;

export type GenerationEntity = Tables<"generations">;
export type GenerationInsertEntity = TablesInsert<"generations">;
export type GenerationUpdateEntity = TablesUpdate<"generations">;

export type GenerationErrorLogEntity = Tables<"generation_error_logs">;

/**
 * Shared DTOs
 */
export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
}

/**
 * Flashcards - DTOs and Commands
 */

// Minimal list item shape as per API examples (omits internal fields like user_id)
export type FlashcardSummaryDTO = Pick<
  FlashcardEntity,
  "id" | "front" | "back" | "source" | "created_at" | "updated_at"
>;

// Detail view: include generation_id when present, still omit user_id
export type FlashcardDetailDTO = Omit<FlashcardEntity, "user_id">;

export interface GetFlashcardsResponseDTO {
  data: FlashcardSummaryDTO[];
  pagination: PaginationDTO;
}

// Client command for creating flashcards (server derives user_id; timestamps are DB-managed)
export type CreateFlashcardCommand = Pick<FlashcardInsertEntity, "front" | "back" | "source" | "generation_id">;

export interface CreateFlashcardsRequestDTO {
  flashcards: CreateFlashcardCommand[];
}

// API shows created flashcards with ids and core fields
export interface CreateFlashcardsResponseDTO {
  flashcards: Pick<FlashcardEntity, "id" | "front" | "back" | "source" | "generation_id">[];
}

// Client command for updating a flashcard (only editable fields per API plan)
export type UpdateFlashcardCommand = Pick<FlashcardUpdateEntity, "front" | "back" | "source">;

export type UpdateFlashcardResponseDTO = FlashcardDetailDTO;

export interface DeleteFlashcardResponseDTO {
  success: true;
  id: number;
}

/**
 * Generations - DTOs and Commands
 */

// Client command to initiate generation
export interface CreateGenerationCommand {
  /** User-provided text; validated to 1000-10000 chars server-side */
  source_text: string;
}

// Proposal items are not persisted yet; re-use Insert shape subset for clarity
export type FlashcardProposalDTO = Pick<FlashcardInsertEntity, "front" | "back" | "source">;

export interface CreateGenerationResponseDTO {
  generation_id: number;
  flashcards_proposals: FlashcardProposalDTO[];
  generated_count: number;
}

// Public view of generation metadata (omit user_id)
export type GenerationDTO = Omit<GenerationEntity, "user_id">;

export interface GetGenerationsResponseDTO {
  data: GenerationDTO[];
  pagination: PaginationDTO;
}

export interface GetGenerationDetailResponseDTO {
  generation: GenerationDTO;
  flashcards: FlashcardDetailDTO[];
}

/**
 * Generation Error Logs - DTOs
 */
export type GenerationErrorLogDTO = GenerationErrorLogEntity;

export interface GetGenerationErrorLogsResponseDTO {
  data: GenerationErrorLogDTO[];
}
