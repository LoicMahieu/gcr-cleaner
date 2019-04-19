const execa = require("execa");
const Table = require("cli-table");
const { BooleanPrompt } = require("enquirer");

const run = async opts => {
  const imagesRaw = await execGCloud(
    `container images list --format='value(name)'`,
    opts,
  );
  const images = imagesRaw.split("\n");
  for (const image of images) {
    await cleanImage(image, opts);
    console.log();
  }
};

const cleanImage = async (image, opts) => {
  console.log("# Image:", image);

  const allTagsRaw = await execGCloud(
    `container images list-tags "${image}" --sort-by="~timestamp" --sort-by="~timestamp" --format=json --limit=999999`,
    opts,
  );
  const allTags = JSON.parse(allTagsRaw);

  const tagsToKeep = allTags.slice(0, opts.keep);
  const tagsToDelete = allTags.slice(opts.keep);

  console.log(`Tags to keep: ${tagsToKeep.length}`);
  logTags(tagsToKeep);

  console.log(`Tags to delete: ${tagsToDelete.length}`);
  logTags(tagsToDelete);

  if (tagsToDelete.length && (await promptConfirm())) {
    await deleteTags(image, tagsToDelete, opts);
  }
};

const deleteTags = async (image, tags, opts) => {
  for (const tag of tags) {
    console.log(`Delete image: ${image}@${tag.digest}`);
    await execGCloud(
      `container images delete -q --force-delete-tags "${image}@${tag.digest}"`,
      opts,
    );
  }
};

// Utils

const logTags = tags => {
  if (!tags.length) {
    return;
  }

  const table = new Table({
    head: ["Timestamp", "Tags", "Digest"],
  });

  table.push(
    ...tags.map(t => [t.timestamp.datetime, t.tags.join(", "), t.digest]),
  );

  console.log(table.toString());
};

const execGCloud = async (cmd, opts) => {
  const gcloud = [`gcloud`, opts.project && `--project ${opts.project}`]
    .filter(Boolean)
    .join(" ");
  const { stdout } = await execa.shell(`${gcloud} ${cmd}`);
  return stdout;
};

const promptConfirm = () => {
  return new BooleanPrompt({
    type: "boolean",
    message: "Process to delete ? (Y/N)",
  }).run();
};

module.exports = { run };
