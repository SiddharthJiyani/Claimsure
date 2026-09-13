export function slackWebhookUrl() {
  return (process.env.SLACK_WEBHOOK_URL ?? "").trim();
}

export function slackChannelName() {
  return process.env.NEXT_PUBLIC_SLACK_CHANNEL_NAME ?? "claimsure-updates";
}

export function slackWorkspaceUrl() {
  return (
    process.env.NEXT_PUBLIC_SLACK_WORKSPACE_URL ?? "https://slack.com"
  );
}

export function isSlackConfigured() {
  return slackWebhookUrl().startsWith("https://hooks.slack.com/");
}

export async function postSlackChannelUpdate(input: {
  title: string;
  message: string;
  caseNumber?: string;
  event?: string;
}) {
  const webhook = slackWebhookUrl();
  if (!webhook.startsWith("https://hooks.slack.com/")) return;

  const text = input.caseNumber
    ? `${input.title} · ${input.caseNumber}`
    : input.title;
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: input.title.slice(0, 150) },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: input.message.slice(0, 2900) },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: [
                input.caseNumber ? `*Case:* ${input.caseNumber}` : null,
                input.event ? `*Event:* ${input.event}` : null,
                `*Channel:* #${slackChannelName()}`,
              ]
                .filter(Boolean)
                .join("  ·  "),
            },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Slack webhook failed (${response.status})`);
  }
}
