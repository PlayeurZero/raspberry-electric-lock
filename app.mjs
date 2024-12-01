import http from "http";
import rpio from "rpio";
import fs from "node:fs/promises";
import path from "path";

rpio.init({
  mapping: "gpio",
  close_on_exit: false,
});

const raspberry = new (class {
  #button;

  #relay;

  constructor() {
    this.#button = 27;
    this.#relay = 21;

    rpio.open(this.#button, rpio.INPUT, rpio.PULL_UP);
    rpio.open(this.#relay, rpio.OUTPUT);

    rpio.write(this.#relay, rpio.LOW);
  }

  async init() {
    await fs.mkdir(this.getLogFilepath(), { recursive: true });
  }

  exit() {
    rpio.write(this.#relay, rpio.LOW);
    rpio.exit();
  }

  async #daemon() {
    if (rpio.LOW === rpio.read(this.#button)) {
      await this.openRelay("button");
    }

    setImmediate(() => this.#daemon());
  }

  getLogFilepath() {
    return process.env.LOG_FILEPATH ?? "logs";
  }

  async #log(message) {
    const now = new Date();
    const filename = `${now.getFullYear()}-${String(now.getMonth() + 1).padEnd(2, 0)}-${String(now.getDate()).padEnd(2, 0)}.log`;
    const filepath = `${path.join(process.env.LOG_FILEPATH ?? "logs", filename)}`;

    await fs.appendFile(filepath, `[${new Date().toISOString()}]${message}\n`);
  }

  async openRelay(source) {
    if (rpio.LOW === rpio.read(this.#relay)) {
      await this.#log(`[${source}] relay open request`);

      rpio.write(this.#relay, rpio.HIGH);

      setTimeout(() => {
        rpio.write(this.#relay, rpio.LOW);
      }, 5000);
    }
  }

  async runDaemon() {
    await this.#daemon();
  }

  runHttpServer() {
    const server = http.createServer(async function (req, res) {
      await raspberry.openRelay("http");

      res.end();
    });

    server.listen(8080);
  }
})();

async function main() {
  await raspberry.init();
  raspberry.runDaemon();
  raspberry.runHttpServer();
}

main();

function handleExit(e) {
  raspberry.exit();
  process.exit();
}

process.on("uncaughtException", handleExit);
process.on("exit", handleExit);
process.on("SIGINT", handleExit);
