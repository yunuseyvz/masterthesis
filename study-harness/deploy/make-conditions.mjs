#!/usr/bin/env node
// Writes the study's entry for Conditioner's conditions.json (docs/harness/deployment.md): one condition per
// counterbalancing group and round, all with the same image. N should be a multiple of 12.
//
// Usage: node study-harness/deploy/make-conditions.mjs [completion redirect] > conditions.json
const [completionRedirect] = process.argv.slice(2);

// As in run-session.sh; the image's own environment does the rest.
const isolation = ["--cap-drop", "ALL", ...["SETUID", "SETGID", "CHOWN", "DAC_OVERRIDE", "KILL"].flatMap((c) => ["--cap-add", c]), "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "3g"];
const env = (values) => Object.entries(values).flatMap(([k, v]) => ["--env", `${k}=${v}`]);

const conditions = [];
for (let group = 0; group < 6; group++)
  for (let round = 0; round < 2; round++)
    conditions.push({
      condition_name: `g${group}r${round}`,
      image_ref: "localhost/beacon:latest",
      exposed_port: 5185,
      idle_timeout_seconds: 3600,
      podman_args: [
        ...env({ STUDY_GROUP: group, STUDY_ROUND: round, LISTEN_SOCKET: "", LISTEN_HOST: "0.0.0.0", EXPORT_DIR: "/data/exports", LIVE_MODEL: "study-chat", LIVE_UPSTREAM: "http://litellm:4000/v1", SESSION_RECORDING: 0 }),
        ...isolation,
      ],
    });

console.log(JSON.stringify([{
  study_name: "Beacon",
  study_slug: "beacon",
  supervisor: "",
  info_html: "studies/beacon/info.html",
  consent_html: "studies/beacon/consent.html",
  ...(completionRedirect ? { completion_redirect: completionRedirect } : {}),
  conditions,
}], null, 2));
