// deps
import "dotenv/config";
import http from "node:http";
import https from "node:https";
import rpio from "rpio";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
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
    return;
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
    const httpsServer = https.createServer(
      {
        key: readFileSync("certs/server-key.pem"),
        cert: readFileSync("certs/server-cert.pem"),
      },
      async function (req, res) {
        if (req.url.includes("..")) {
          res.writeHead(400);
          res.end();
        }

        if ("/api/unlock" === req.url) {
          raspberry.openRelay("http");
          res.writeHead(204);
          res.end();
        } else {
          let filepath = path.resolve(
            "public",
            "/" === req.url ? "index.html" : req.url.slice(1),
          );

          try {
            await fs.stat(path.resolve(filepath));
            let fileExt = path.extname(filepath);

            if (fileExt === ".html") {
              res.setHeader("content-type", "text/html");
            } else if (fileExt === ".js") {
              res.setHeader("content-type", "text/javascript");
            } else if (fileExt === ".png") {
              //            res.setHeader("content-type", "image/png")
            } else if (fileExt === ".json") {
              res.setHeader("content-type", "application/json");
            }

            createReadStream(filepath).pipe(res);
          } catch {
            res.writeHead(404);
            res.end();
          }
        }
      },
    );

    httpsServer.listen(process.env.HTTPS_SERVER_PORT);

    const httpServer = http.createServer(async function (req, res) {
      const hostname = req.headers.host.split(":")[0];
      res.setHeader(
        "location",
        `https://${hostname}:${process.env.HTTPS_SERVER_PORT}`,
      );
      res.writeHead(301);
      res.end();
    });

    httpServer.listen(process.env.HTTP_SERVER_PORT);
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
