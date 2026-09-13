/**
 * Slack service — Block Kit approval messages and escalation alerts.
 * Uses @slack/bolt with Socket Mode for interactive button callbacks.
 * The Slack approval endpoint is handled by the webhooks controller.
 */

import { App as SlackApp } from "@slack/bolt";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

let _slackApp: SlackApp | null = null;

function getSlackApp(): SlackApp {
  if (_slackApp) return _slackApp;

  if (!env.SLACK_BOT_TOKEN || !env.SLACK_SIGNING_SECRET) {
    throw new Error("Slack credentials not configured");
  }

  _slackApp = new SlackApp({
    token: env.SLACK_BOT_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    socketMode: !!env.SLACK_APP_TOKEN,
    ...(env.SLACK_APP_TOKEN ? { appToken: env.SLACK_APP_TOKEN } : {}),
  });

  return _slackApp;
}

export interface ApprovalMessageParams {
  caseId: string;
  caseNumber: string;
  serviceType: string;
  denialReason: string;
  agentSummary: string;
  confidence: number;
  channelId?: string;
}

export interface EscalationMessageParams {
  caseId: string;
  caseNumber: string;
  serviceType: string;
  reason: string;
  channelId?: string;
}

export async function sendApprovalRequest(
  params: ApprovalMessageParams,
): Promise<{ ts: string }> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: sendApprovalRequest", { caseId: params.caseId });
    return { ts: "DRY_RUN_TS" };
  }

  if (!env.SLACK_BOT_TOKEN) {
    logger.warn("Slack not configured, skipping approval request");
    return { ts: "NOT_CONFIGURED" };
  }

  try {
    const slack = getSlackApp();
    const channelId = params.channelId ?? env.SLACK_APPROVAL_CHANNEL_ID;

    if (!channelId) throw new Error("No Slack channel configured");

    const res = await slack.client.chat.postMessage({
      channel: channelId,
      text: `Appeal Review Required: Case ${params.caseNumber}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🔍 Appeal Review: ${params.caseNumber}`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Service:*\n${params.serviceType}` },
            {
              type: "mrkdwn",
              text: `*Confidence:*\n${(params.confidence * 100).toFixed(0)}%`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Denial Reason:*\n${params.denialReason}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Agent Summary:*\n${params.agentSummary}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "✅ Approve Appeal" },
              style: "primary",
              action_id: "approve_appeal",
              value: JSON.stringify({
                caseId: params.caseId,
                action: "approved",
              }),
            },
            {
              type: "button",
              text: { type: "plain_text", text: "❌ Reject Appeal" },
              style: "danger",
              action_id: "reject_appeal",
              value: JSON.stringify({
                caseId: params.caseId,
                action: "rejected",
              }),
            },
            {
              type: "button",
              text: { type: "plain_text", text: "📋 More Info Needed" },
              action_id: "more_info",
              value: JSON.stringify({
                caseId: params.caseId,
                action: "more_info",
              }),
            },
          ],
        },
      ],
    });

    logger.info("Slack approval message sent", {
      caseId: params.caseId,
      ts: res.ts,
    });
    return { ts: res.ts ?? "unknown" };
  } catch (err) {
    logger.error("Slack sendApprovalRequest failed", err);
    throw err;
  }
}

export async function sendEscalationAlert(
  params: EscalationMessageParams,
): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: sendEscalationAlert", { caseId: params.caseId });
    return;
  }

  if (!env.SLACK_BOT_TOKEN) {
    logger.warn("Slack not configured, skipping escalation alert");
    return;
  }

  try {
    const slack = getSlackApp();
    const channelId = params.channelId ?? env.SLACK_APPROVAL_CHANNEL_ID;

    if (!channelId) return;

    await slack.client.chat.postMessage({
      channel: channelId,
      text: `🚨 Case Escalated: ${params.caseNumber}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🚨 Escalation Required: ${params.caseNumber}`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Service:*\n${params.serviceType}` },
            { type: "mrkdwn", text: `*Case ID:*\n${params.caseId}` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Escalation Reason:*\n${params.reason}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "plain_text",
              text: "Agent abstained — clinical ambiguity or safety constraint triggered. Human review required.",
            },
          ],
        },
      ],
    });

    logger.info("Slack escalation alert sent", { caseId: params.caseId });
  } catch (err) {
    logger.error("Slack sendEscalationAlert failed", err);
    // Non-fatal
  }
}

function configuredWebhook() {
  const webhook = env.SLACK_WEBHOOK_URL?.trim() ?? "";
  return webhook.startsWith("https://hooks.slack.com/services/") ? webhook : "";
}

function configuredBot() {
  const bot = env.SLACK_BOT_TOKEN?.trim() ?? "";
  if (!bot.startsWith("xoxb-") || bot.includes("your-slack-bot-token")) return "";
  return bot;
}

function configuredChannel() {
  const channel = env.SLACK_APPROVAL_CHANNEL_ID?.trim() ?? "";
  if (!channel || channel.includes("XXXX")) return env.SLACK_CHANNEL_NAME?.trim() || "claimsure-updates";
  return channel;
}

export function isSlackConfigured() {
  return Boolean(configuredWebhook() || (configuredBot() && configuredChannel()));
}

export interface ChannelUpdateParams {
  title: string;
  message: string;
  caseNumber?: string;
  serviceType?: string;
  event?: string;
}

export async function sendChannelUpdate(
  params: ChannelUpdateParams,
): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: sendChannelUpdate", params);
    return;
  }

  const text = params.caseNumber
    ? `${params.title} · ${params.caseNumber}`
    : params.title;
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: params.title.slice(0, 150) },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: params.message.slice(0, 2900) },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: [
            params.caseNumber ? `*Case:* ${params.caseNumber}` : null,
            params.serviceType ? `*Service:* ${params.serviceType}` : null,
            params.event ? `*Event:* ${params.event}` : null,
            `Channel: ${env.SLACK_CHANNEL_NAME || "Claimsure updates"}`,
          ]
            .filter(Boolean)
            .join("  ·  "),
        },
      ],
    },
  ];

  const webhook = configuredWebhook();
  if (webhook) {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Slack webhook failed (${response.status}): ${detail}`);
    }
    logger.info("Slack channel update sent via webhook", {
      title: params.title,
    });
    return;
  }

  const token = configuredBot();
  const channel = configuredChannel();
  if (!token || !channel) {
    logger.warn("Slack not configured, skipping channel update");
    return;
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text, blocks }),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!body.ok) {
    throw new Error(body.error ?? "Slack chat.postMessage failed");
  }
  logger.info("Slack channel update sent via bot", { title: params.title });
}

export async function sendTextMessage(
  channelId: string,
  text: string,
): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: sendTextMessage", {
      channelId,
      text: text.slice(0, 50),
    });
    return;
  }

  if (!env.SLACK_BOT_TOKEN) return;

  try {
    const slack = getSlackApp();
    await slack.client.chat.postMessage({ channel: channelId, text });
  } catch (err) {
    logger.error("Slack sendTextMessage failed", err);
  }
}
