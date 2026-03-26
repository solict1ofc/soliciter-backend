// Entry point — starts the pre-built server bundle (created by npm run build)
import("./dist/index.mjs").catch((err) => {
  console.error(err);
  process.exit(1);
});
