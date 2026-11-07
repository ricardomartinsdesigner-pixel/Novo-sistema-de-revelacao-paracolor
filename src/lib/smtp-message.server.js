import { Buffer } from "node:buffer";
import { z } from "zod";

const messageInput = z.object({
  to: z.string().max(254).email(),
  from_email: z.string().max(254).email(),
  from_name: z.string().max(300),
  reply_to: z.union([z.literal(""), z.string().max(254).email()]).optional(),
  subject: z.string().min(1).max(500),
  text: z.string().max(262144),
  html: z.string().max(524288),
});

export const smtpBase64 = (value) => Buffer.from(value, "utf8").toString("base64");
const body = (value) => smtpBase64(value).match(/.{1,76}/g)?.join("\r\n") || "";
function header(value) {
  const chars = Array.from(value.replace(/[\r\n\0]/g, " "));
  const parts = [];
  for (let index = 0; index < chars.length; index += 10) parts.push(`=?UTF-8?B?${smtpBase64(chars.slice(index, index + 10).join(""))}?=`);
  return parts.join("\r\n ");
}

export function createSmtpMessage(input) {
  const message = messageInput.parse(input);
  const boundary = `paracolor-${crypto.randomUUID()}`;
  const domain = message.from_email.split("@")[1];
  const lines = [
    `From: ${header(message.from_name)} <${message.from_email}>`,
    `To: <${message.to}>`,
    ...(message.reply_to ? [`Reply-To: <${message.reply_to}>`] : []),
    `Subject: ${header(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64", "", body(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64", "", body(message.html),
    `--${boundary}--`, "",
  ];
  return { ...message, data: `${lines.join("\r\n").replace(/^\./gm, "..")}\r\n.` };
}