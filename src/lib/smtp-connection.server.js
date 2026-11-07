import net from "node:net";
import tls from "node:tls";

export class SmtpError extends Error {}

export class SmtpConnection {
  constructor(config) {
    this.config = config;
    this.buffer = "";
    this.waiters = [];
    this.socket = config.security === "tls"
      ? tls.connect({ host: config.host, port: config.port, servername: config.host })
      : net.connect({ host: config.host, port: config.port });
    this.socket.opened = new Promise((resolve, reject) => {
      this.socket.once(config.security === "tls" ? "secureConnect" : "connect", resolve);
      this.socket.once("error", reject);
    });
    this.attach(this.socket);
  }

  attach(socket) {
    this.socket = socket;
    this.onData = (data) => { this.buffer += data.toString("utf8"); this.flushLines(); };
    this.onError = (error) => { for (const waiter of this.waiters.splice(0)) waiter.reject(error); };
    socket.on("data", this.onData);
    socket.on("error", this.onError);
  }

  flushLines() {
    while (this.buffer.includes("\r\n") && this.waiters.length) {
      const index = this.buffer.indexOf("\r\n");
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      this.waiters.shift().resolve(line);
    }
  }

  line() {
    if (this.buffer.includes("\r\n")) {
      const index = this.buffer.indexOf("\r\n");
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      return Promise.resolve(line);
    }
    if (this.buffer.length > 65536) return Promise.reject(new SmtpError("Resposta SMTP inválida."));
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async reply(expected, stage) {
    const lines = [];
    let code;
    for (let count = 0; count < 100; count++) {
      const match = /^(\d{3})([ -])(.*)$/.exec(await this.line());
      if (!match || (code && code !== Number(match[1]))) throw new SmtpError("Resposta SMTP inválida.");
      code = Number(match[1]);
      lines.push(match[3]);
      if (match[2] !== " ") continue;
      if (!expected.includes(code)) {
        const help = code === 535 || code === 534 ? " Confira o usuário, a senha de aplicativo e a permissão SMTP." : "";
        throw new SmtpError(`SMTP recusou ${stage} (código ${code}).${help}`);
      }
      return lines.join("\n");
    }
    throw new SmtpError("Resposta SMTP excedeu o limite permitido.");
  }

  async command(value, expected, stage) {
    await new Promise((resolve, reject) => this.socket.write(`${value}\r\n`, (error) => error ? reject(error) : resolve()));
    return this.reply(expected, stage);
  }

  async upgrade() {
    const previous = this.socket;
    previous.removeListener("data", this.onData);
    previous.removeListener("error", this.onError);
    const secure = tls.connect({ socket: previous, servername: this.config.host });
    secure.opened = new Promise((resolve, reject) => {
      secure.once("secureConnect", resolve);
      secure.once("error", reject);
    });
    this.attach(secure);
    await secure.opened;
  }

  async close() {
    if (!this.socket.destroyed) this.socket.end();
  }
}
