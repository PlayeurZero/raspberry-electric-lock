// deps
import "dotenv/config";
import http from "node:http";
import rpio from "rpio";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

// utils
import wait from "./utils/wait.mjs";

rpio.init({
  mapping: "gpio",
  close_on_exit: false,
});

const raspberry = new (class {
  #button;

  #relay;

  constructor() {
    this.#button = Number(process.env.BUTTON_GPIO_PIN);
    this.#relay = Number(process.env.RELAY_GPIO_PIN);

    rpio.open(this.#button, rpio.INPUT, rpio.PULL_UP);
    rpio.open(this.#relay, rpio.OUTPUT);

    rpio.write(this.#relay, rpio.LOW);

    this.#log("started electric lock");
  }

  async #daemon() {
    if (rpio.LOW === rpio.read(this.#button)) {
      await wait(process.env.BUTTON_OPENED_DEBOUNCE_DELAY ?? 100);
      if (rpio.LOW === rpio.read(this.#button)) {
        await this.openRelay("button");
      }
    }

    setTimeout(() => this.#daemon(), process.env.POLLING_LOOP_DELAY ?? 250);
  }

  async #log(message) {
    const now = new Date();
    const filename = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, 0)}-${String(now.getDate()).padStart(2, 0)}.log`;
    const filepath = `${path.join(process.env.LOG_FILEPATH ?? "logs", filename)}`;

    await fs.appendFile(filepath, `[${new Date().toISOString()}] ${message}\n`);
  }

  async openRelay(source) {
    if (rpio.LOW === rpio.read(this.#relay)) {
      await this.#log(`(${source}) relay open request`);

      rpio.write(this.#relay, rpio.HIGH);

      setTimeout(() => {
        rpio.write(this.#relay, rpio.LOW);
      }, process.env.KEEP_OPENED_DELAY ?? 1000);
    }
  }

  async runDaemon() {
    this.#daemon();
  }

  runHttpServer() {
    const server = http.createServer(async function (req, res) {
      if (req.url.includes("..")) {
        res.writeHead(400)
        res.end()
      }

      if ("/api/unlock" === req.url) {
        raspberry.openRelay("http")
        res.writeHead(204);
        res.end();
      } else {
        let filepath = path.resolve("public", "/" === req.url
          ? "index.html"
          : req.url)

        try {
          await fs.stat(path.resolve(filepath))
          createReadStream(filepath).pipe(res)
        } catch {
          res.writeHead(404)
          res.end()
        }
      }
    });

    server.listen(8080);
  }
})();

async function main() {
  raspberry.runDaemon();
  raspberry.runHttpServer();
}

main();

function handleExit(error) {
  console.error(error);

  rpio.exit();
  process.exit();
}

process.on("exit", handleExit);
process.on("SIGINT", handleExit);
process.on("uncaughtException", handleExit);
