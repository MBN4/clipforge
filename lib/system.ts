import { runChecks } from "./systemChecks.mjs";

export type SystemCheck = {
  id: string;
  label: string;
  level: "required" | "recommended";
  ok: boolean;
  detail: string;
  fix?: { linux?: string; mac?: string; windows?: string; any?: string };
};
export type SystemReport = {
  platform: string;
  checks: SystemCheck[];
  ready: boolean;
  canDownloadLinks: boolean;
  canCaption: boolean;
  binDir: string;
};

// Running the checks spawns a handful of processes, so keep the answer for a short while.
const g = globalThis as unknown as { __clipforgeSystem?: { at: number; report: SystemReport } };

export function getSystemReport(force = false): SystemReport {
  const hit = g.__clipforgeSystem;
  if (!force && hit && Date.now() - hit.at < 20_000) return hit.report;
  const report = runChecks() as SystemReport;
  g.__clipforgeSystem = { at: Date.now(), report };
  return report;
}
