import { z } from 'zod';

const MAX_PARTICIPANT_LIMIT = 50;

export const createMeetingSchema = z.object({
  projectId: z.string().min(1, 'Choose a project'),
  meetingTitle: z.string().trim().min(3, 'Title must be at least 3 characters'),
  meetingDescription: z.string().trim().optional(),
  meetingScheduledAt: z
    .string()
    .min(1, 'Choose a date and time')
    .refine(
      (val) => {
        const d = new Date(val);
        if (isNaN(d.getTime())) return false;
        // Allow up to 5 minutes in the past to account for form fill time
        return d.getTime() >= Date.now() - 5 * 60 * 1000;
      },
      { message: 'Meeting start date cannot be in the past' }
    ),
  meetingDurationMinutes: z
    .number()
    .int('Duration must be a whole number')
    .min(1, 'Duration must be at least 1 minute')
    .max(480, 'Duration cannot exceed 8 hours'),
  meetingJoinMode: z.enum(['INVITE_ONLY', 'OPEN_LINK']),
  meetingParticipantLimit: z
    .number()
    .int('Limit must be a whole number')
    .min(1, 'Limit must be at least 1')
    .max(MAX_PARTICIPANT_LIMIT, `Limit cannot exceed ${MAX_PARTICIPANT_LIMIT}`),
});

export type CreateMeetingFormValues = z.infer<typeof createMeetingSchema>;

export const askQuestionSchema = z.object({
  questionText: z.string().trim().min(3, 'Question must be at least 3 characters'),
});

export const answerQuestionSchema = z.object({
  answerText: z.string().trim().min(2, 'Answer must be at least 2 characters'),
});

export const createPollSchema = z.object({
  pollQuestion: z.string().trim().min(3, 'Poll question must be at least 3 characters'),
  options: z
    .array(z.string().trim().min(1, 'Option cannot be empty'))
    .min(2, 'Add at least two options')
    .max(10, 'A poll can have at most 10 options'),
  multipleChoice: z.boolean(),
});