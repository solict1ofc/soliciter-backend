import("./server/dist/index.mjs").catch((err) => {
  console.error(err);
  process.exit(1);
});
