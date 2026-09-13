import React from "react";
import {
  googleSheetsUrl,
  googleCalendarUrl,
  googleDriveFolderUrl,
} from "@/lib/env";
import type { ClaimCase } from "@/lib/types";
import {
  Table,
  Calendar,
  HardDrive,
  Cpu,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

export function ConnectedServicesPanel({ claim }: { claim: ClaimCase }) {
  const sheetsUrl = googleSheetsUrl();
  const calendarUrl = googleCalendarUrl();
  const driveUrl = googleDriveFolderUrl();

  const driveFiles = (claim.documents ?? []).filter((d) => Boolean(d.drive_url || d.drive_file_id));

  return (
    <section className="cs-panel rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="cs-kicker">Ecosystem Integrations</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Live Google Services & MCP Architecture
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <CheckCircle2 size={13} />
          Multi-App Active
        </span>
      </div>

      <p className="mt-2 text-xs text-muted leading-relaxed">
        Claimsure is wired directly to your external enterprise tools. Every case transition automatically mirrors to Google Sheets, schedules deadlines on Google Calendar, stores files in Google Drive, and routes via Model Context Protocol (MCP).
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Google Sheets */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-2 p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <Table size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Google Sheets</span>
              </div>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Live Sync
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-foreground">
              Sheet: Claimsure Cases
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              Tab: Cases · Row #{claim.case_number}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Status mirrored: <span className="font-semibold text-foreground">{claim.status}</span>
            </p>
          </div>
          <a
            href={sheetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            Open in Sheets
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Google Calendar */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-2 p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400">
                <Calendar size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Google Calendar</span>
              </div>
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                Events Active
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-foreground">
              Review Reminders & Deadlines
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Event: Case Review: {claim.case_number}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Service: {claim.service_type}
            </p>
          </div>
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Open in Calendar
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Google Drive */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-2 p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <HardDrive size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Google Drive</span>
              </div>
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                Evidence Cloud
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-foreground">
              Folder: patients/
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Attached files: <span className="font-semibold text-foreground">{claim.documents?.length ?? 0}</span>
            </p>
            {driveFiles[0] ? (
              <p className="mt-1 truncate font-mono text-[11px] text-muted">
                File: {driveFiles[0].name}
              </p>
            ) : null}
          </div>
          <a
            href={driveFiles[0]?.drive_url || driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
          >
            View in Drive
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Model Context Protocol (MCP) */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-2 p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-violet-400">
                <Cpu size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">MCP Protocol</span>
              </div>
              <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                11 Tools Ready
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-foreground">
              Claimsure MCP Server
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Standardized Anthropic Model Context Protocol on stdio
            </p>
            <p className="mt-1 font-mono text-[10px] text-violet-300/80">
              policy_search · sheets_sync · calendar
            </p>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-400">
            Inspector: localhost:5173
          </span>
        </div>
      </div>
    </section>
  );
}
