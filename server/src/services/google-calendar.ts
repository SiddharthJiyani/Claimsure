/**
 * Google Calendar service — creates appeal deadline events and review reminders.
 * Events are added to the shared calendar (GOOGLE_CALENDAR_ID).
 */

import { google, type calendar_v3 } from 'googleapis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { getGoogleAuth } from './google-auth.js';

const DRY_RUN_EVENT_ID = "DRY_RUN_EVENT_ID";

function getCalendarClient(): calendar_v3.Calendar {
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/calendar']);
  return google.calendar({ version: 'v3', auth });
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink: string | null;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (defaults to startDate)
  attendeeEmails?: string[];
}

function datePlusDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function createCaseReviewEvent(input: {
  caseNumber: string;
  patientName?: string;
  serviceType?: string;
  disease?: string;
  claimPurpose?: string;
  driveUrl?: string;
  reviewInDays?: number;
}): Promise<CalendarEvent> {
  const startDate = datePlusDays(input.reviewInDays ?? 3);
  return createAppealDeadlineEvent({
    summary: `Claim review: ${input.caseNumber}`,
    description: [
      `Case: ${input.caseNumber}`,
      input.patientName ? `Patient: ${input.patientName}` : "",
      input.serviceType ? `Service: ${input.serviceType}` : "",
      input.disease ? `Disease: ${input.disease}` : "",
      input.claimPurpose ? `Purpose: ${input.claimPurpose}` : "",
      input.driveUrl ? `Drive: ${input.driveUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    startDate,
    endDate: datePlusDays((input.reviewInDays ?? 3) + 1),
  });
}

export async function createAppealDeadlineEvent(
  input: CreateEventInput,
): Promise<CalendarEvent> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: createCalendarEvent", { summary: input.summary });
    return {
      id: DRY_RUN_EVENT_ID,
      summary: input.summary,
      start: input.startDate,
      end: input.endDate ?? input.startDate,
      htmlLink: null,
    };
  }

  if (!env.GOOGLE_CALENDAR_ID) {
    logger.warn('Calendar not configured, skipping event creation');
    return {
      id: "NOT_CONFIGURED",
      summary: input.summary,
      start: input.startDate,
      end: input.endDate ?? input.startDate,
      htmlLink: null,
    };
  }

  try {
    const calendar = getCalendarClient();

    const res = await calendar.events.insert({
      calendarId: env.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: input.summary,
        ...(input.description !== undefined ? { description: input.description } : {}),
        start: { date: input.startDate },
        end: { date: input.endDate ?? input.startDate },
        ...(input.attendeeEmails !== undefined ? { attendees: input.attendeeEmails.map((email) => ({ email })) } : {}),
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 60 * 24 * 3 }, // 3 days before
            { method: "popup", minutes: 60 * 24 }, // 1 day before
          ],
        },
      },
    });

    logger.info("Calendar event created", {
      eventId: res.data.id,
      summary: input.summary,
    });

    return {
      id: res.data.id ?? "unknown",
      summary: res.data.summary ?? input.summary,
      start: input.startDate,
      end: input.endDate ?? input.startDate,
      htmlLink: res.data.htmlLink ?? null,
    };
  } catch (err) {
    logger.error("Calendar event creation failed", err);
    // Non-fatal
    return {
      id: "ERROR",
      summary: input.summary,
      start: input.startDate,
      end: input.endDate ?? input.startDate,
      htmlLink: null,
    };
  }
}
