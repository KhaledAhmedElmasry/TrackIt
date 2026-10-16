import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/session";
import { handleApiError } from "@/lib/errors/app-error";

export async function POST() {
  try {
    await revokeCurrentSession();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}

