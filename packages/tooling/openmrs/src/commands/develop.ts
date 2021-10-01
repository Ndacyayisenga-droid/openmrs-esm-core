import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { resolve } from "path";
import { readFileSync } from "fs";
import {
  ImportmapDeclaration,
  logInfo,
  logWarn,
  removeTrailingSlash,
} from "../utils";

/* eslint-disable no-console */

export interface DevelopArgs {
  port: number;
  host: string;
  backend: string;
  open: boolean;
  importmap: ImportmapDeclaration;
  spaPath: string;
  apiUrl: string;
  configUrls: Array<string>;
}

export function runDevelop(args: DevelopArgs) {
  const { backend, host, port, open, importmap, configUrls } = args;
  const apiUrl = removeTrailingSlash(args.apiUrl);
  const spaPath = removeTrailingSlash(args.spaPath);
  const app = express();
  const source = resolve(
    require.resolve("@openmrs/esm-app-shell/package.json"),
    "..",
    "lib"
  );
  const index = resolve(source, "index.html");
  const indexContent = readFileSync(index, "utf8")
    .replace(
      RegExp("<script>[\\s\\S]+</script>"),
      `
    <script>
        initializeSpa({
          apiUrl: ${JSON.stringify(apiUrl)},
          spaPath: ${JSON.stringify(spaPath)},
          env: "development",
          offline: true,
          configUrls: ${JSON.stringify(configUrls)},
        });
    </script>
  `
    )
    .replace(/href="\/openmrs\/spa/g, `href="${spaPath}`)
    .replace(/src="\/openmrs\/spa/g, `src="${spaPath}`);

  const pageUrl = `http://${host}:${port}${spaPath}/`;

  app.get(`${spaPath}/importmap.json`, (_, res) => {
    if (importmap.type === "inline") {
      res.contentType("application/json").send(importmap.value);
    } else {
      res.redirect(importmap.value);
    }
  });
  app.use(
    apiUrl,
    createProxyMiddleware([`${apiUrl}/**`, `!${spaPath}/**!(.js|.woff2?)`], {
      target: backend,
      changeOrigin: true,
    })
  );
  app.use(spaPath, express.static(source, { index: false }));
  app.get(`${spaPath}/*`, (_, res) =>
    res.contentType("text/html").send(indexContent)
  );

  app.listen(port, host, () => {
    logInfo(`Listening at http://${host}:${port}`);
    logInfo(`SPA available at ${pageUrl}`);

    if (open) {
      const open = require("open");

      open(pageUrl, { wait: false }).catch(() => {
        logWarn(
          `Unable to open "${pageUrl}" in browser. If you are running in a headless environment, please do not use the --open flag.`
        );
      });
    }
  });

  return new Promise(() => {});
}
