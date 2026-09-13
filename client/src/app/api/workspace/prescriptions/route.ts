import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { aiServerUrl } from "@/lib/env";
import { uploadPatientPrescription } from "@/lib/google-drive";

export async function POST(request: Request) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "patient") {
    return NextResponse.json(
      { error: "Only patients can upload a prescription here" },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a prescription file" }, { status: 400 });
  }

  const payerId =
    typeof form.get("payer_id") === "string" ? String(form.get("payer_id")) : "";

  const aiForm = new FormData();
  aiForm.set("file", file, file.name);
  if (payerId) aiForm.set("payer_id", payerId);

  let parsed: {
    success?: boolean;
    filename?: string;
    extracted_text?: string;
    parse?: Record<string, unknown>;
    rag?: Record<string, unknown>;
    detail?: unknown;
  };
  try {
    const aiResponse = await fetch(`${aiServerUrl()}/api/prescription/parse`, {
      method: "POST",
      body: aiForm,
    });
    parsed = (await aiResponse.json()) as typeof parsed;
    if (!aiResponse.ok) {
      return NextResponse.json(
        { error: formatAiError(parsed.detail) },
        { status: aiResponse.status },
      );
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not reach the AI server. Make sure it is running on AI_SERVER_URL.",
      },
      { status: 502 },
    );
  }

  const patientName =
    profile.full_name?.trim() ||
    (typeof parsed.parse?.patient_name === "string"
      ? parsed.parse.patient_name
      : "") ||
    user.email?.split("@")[0] ||
    "patient";

  const bytes = Buffer.from(await file.arrayBuffer());
  let drive: {
    drive_file_id: string;
    drive_url: string | null;
    folder: string;
  } | null = null;
  let driveError: string | null = null;
  try {
    drive = await uploadPatientPrescription({
      patientName,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      content: bytes,
    });
  } catch (err) {
    driveError = err instanceof Error ? err.message : "Drive upload failed";
  }

  return NextResponse.json({
    filename: parsed.filename ?? file.name,
    extracted_text: parsed.extracted_text ?? "",
    parse: parsed.parse ?? {},
    rag: parsed.rag ?? {},
    drive,
    drive_error: driveError,
  });
}

function formatAiError(detail: unknown) {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: unknown) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "Could not parse the prescription";
}
