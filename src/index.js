"use strict";
const fs = require("fs");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcodeTerminal = require("qrcode-terminal");

const { config, validateForLive } = require("./config");
const { handleMessage } = require("./handler");

const logger = pino({ level: "silent" });

function jidToPhone(jid) {
  return String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, "");
}

function phoneToJid(phone) {
  return `${String(phone).replace(/\D/g, "")}@s.whatsapp.net`;
}

// Disappearing-message and view-once chats wrap the real content
function unwrapMessage(message) {
  if (!message) return {};
  return (
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message
  );
}

function extractText(msg) {
  const m = unwrapMessage(msg.message);
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  );
}

// jidMap lets replies go back to the EXACT address a message arrived from.
// WhatsApp now uses hidden "@lid" addresses for many chats — rebuilding the
// address from the phone number would send those replies nowhere.
async function deliver(sock, outbound, jidMap = {}) {
  for (const msg of outbound) {
    const jid = jidMap[String(msg.to)] || phoneToJid(msg.to);
    try {
      if (msg.imageBuffer) {
        await sock.sendMessage(jid, { image: msg.imageBuffer, caption: msg.caption || "" });
      } else if (msg.imagePath) {
        await sock.sendMessage(jid, {
          image: fs.readFileSync(msg.imagePath),
          caption: msg.caption || "",
        });
      } else if (msg.text) {
        await sock.sendMessage(jid, { text: msg.text });
      }
      // small gap between messages: human-like and reduces spam signals
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`Failed to send to ${msg.to}:`, err.message);
    }
  }
}

async function start() {
  validateForLive();
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      // cacheable key store: required for reliable app-state sync
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    markOnlineOnConnect: false,
    // a sales bot does not need chat history; skipping the heavy history
    // sync avoids the "couldn't finish syncing" stall on login
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
  });

  // Exactly ONE restart may be scheduled per socket lifetime. Without this
  // guard, multiple close events spawn parallel sockets that fight over the
  // same session (stream conflict) and loop forever.
  let restartScheduled = false;
  const scheduleRestart = (ms) => {
    if (restartScheduled) return;
    restartScheduled = true;
    sock.ev.removeAllListeners("messages.upsert");
    sock.ev.removeAllListeners("connection.update");
    setTimeout(() => {
      start().catch((err) => {
        console.error("Reconnect failed:", err.message);
        process.exit(1);
      });
    }, ms);
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log("\nScan this QR with the business WhatsApp (Linked Devices):\n");
      qrcodeTerminal.generate(qr, { small: true });
    }
    if (connection === "open") {
      console.log(`✅ ${config.businessName} sales agent is LIVE on WhatsApp.`);
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error("❌ Logged out by WhatsApp. Delete the ./auth folder and restart to scan a new QR.");
        process.exit(1);
      }
      if (code === DisconnectReason.restartRequired) {
        // normal, happens once right after a successful QR scan
        console.log("↻ Finishing login — reconnecting…");
        scheduleRestart(500);
      } else {
        console.log(`Connection closed (code ${code ?? "unknown"}: ${lastDisconnect?.error?.message || "no reason"}) — reconnecting in 5s…`);
        scheduleRestart(5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const jid = msg.key.remoteJid || "";
        if (jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid.endsWith("@newsletter") || jid === "status@broadcast")
          continue; // ignore groups, statuses, channels

        const text = extractText(msg);
        const hasImage = Boolean(unwrapMessage(msg.message).imageMessage);
        if (!text && !hasImage) continue;

        // Identity: prefer the real phone-number address. For "@lid" chats
        // WhatsApp puts it in remoteJidAlt.
        const pnJid = jid.endsWith("@s.whatsapp.net")
          ? jid
          : (msg.key.remoteJidAlt || "").endsWith("@s.whatsapp.net")
            ? msg.key.remoteJidAlt
            : jid;
        const phone = jidToPhone(pnJid);
        console.log(`📩 ${phone}: ${text ? text.slice(0, 60) : "[image]"}`);

        const outbound = await handleMessage({ from: phone, text, hasImage });
        await deliver(sock, outbound, { [phone]: jid });
      } catch (err) {
        console.error("message processing error:", err);
      }
    }
  });
}

start().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
