#!/usr/bin/env node
// Writes the study's entry for Conditioner's conditions.json: one condition per
// counterbalancing group and round, all with the same image. Conditioner gives a new participant the condition with
// the fewest participants holding a slot, ties to the earliest in this file. Round-first order (g0r0 … g5r0, then
// g0r1 … g5r1) fills the six groups in turn, so they differ by at most one; a dropout frees their slot, and the
// next participant takes it.
//
// Usage: node study-harness/deploy/make-conditions.mjs [completion redirect] > conditions.json
const [completionRedirect] = process.argv.slice(2);

// As in run-session.sh; the image's own environment does the rest.
const isolation = ["--cap-drop", "ALL", ...["SETUID", "SETGID", "CHOWN", "DAC_OVERRIDE", "KILL"].flatMap((c) => ["--cap-add", c]), "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "3g"];
const env = (values) => Object.entries(values).flatMap(([k, v]) => ["--env", `${k}=${v}`]);

const conditions = [];
for (let round = 0; round < 2; round++)
  for (let group = 0; group < 6; group++)
    conditions.push({
      condition_name: `g${group}r${round}`,
      image_ref: "localhost/beacon:latest",
      exposed_port: 5185,
      idle_timeout_seconds: 3600,
      podman_args: [
        ...env({ STUDY_GROUP: group, STUDY_ROUND: round, LISTEN_SOCKET: "", LISTEN_HOST: "0.0.0.0", EXPORT_DIR: "/data/exports", LIVE_MODEL: "study-chat", LIVE_UPSTREAM: "http://litellm:4000/v1", SESSION_RECORDING: 0, STUDY_CONSENT: "external" }),
        ...isolation,
      ],
    });

console.log(JSON.stringify([{
  // Shown to participants (page title) and in their URLs: generic on purpose.
  study_name: "Working with an AI coding agent",
  study_slug: "agentic-coding",
  // Shown on the dashboard only
  supervisor: "Prof. Dr. Albrecht Schmidt; Thomas Weber, Isabel Wanderwitz",
  // Participants holding a slot (not dropouts or released ones). A technical cap, not the planned N (about 30).
  stop_at_n: 36,
  info_html: "studies/agentic-coding/info.html",
  consent_html: "studies/agentic-coding/consent.html",
  // Compensation form after completion, by session length (Conditioner rounds up to 15 minutes).
  compensation_eur_per_hour: 12,
  ...(completionRedirect ? { completion_redirect: completionRedirect } : {}),
  conditions,
}], null, 2));
