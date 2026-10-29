import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = createApp();

app.listen(env.PORT, () => {
  console.log(`creatiq-api listening on http://localhost:${env.PORT}`);
});
