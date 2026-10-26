-- ==============================================================================
-- Migration: 026_conversation_message_lesson_card.sql
-- Description: Keep each answer's visual lesson card (mind map, quiz, flashcards,
--              study guide, diagram...) with the stored assistant message, so a reload
--              or reopening a recent chat shows the visuals again, not just the text.
--              The browser saves the card once it is ready (it can arrive after the
--              text from the Study Visualizer).
-- ==============================================================================

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS lesson_card JSONB NULL;
