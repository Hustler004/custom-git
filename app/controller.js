const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

exports.createGitDirectory = (process) => {
  fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });

  fs.writeFileSync(
    path.join(process.cwd(), ".git", "HEAD"),
    "ref: refs/heads/main\n"
  );
  console.log("Initialized git directory");
};
// -t - type

exports.readBlob = (process) => {
  try {
    const hash = process.argv[4];
    const sub_dir = hash.substring(0, 2);
    const filename = hash.substring(2);
    const content = fs.readFileSync(
      path.join(process.cwd(), `.git/objects/${sub_dir + "/" + filename}`)
      // "utf-8"
    );
    const decompressed = zlib.inflateSync(content);
    if (process.argv[3] === "-p") {
      const nullCharIndex = decompressed.indexOf(0);

      // Extract the actual content after the null character
      const actualContent = decompressed.slice(nullCharIndex + 1);

      // Convert the content to a string (assuming utf-8 encoding)
      const decompressedString = actualContent.toString("utf-8");
      process.stdout.write(decompressedString);
    } else if (process.argv[3] === "-t") {
      const decompressedString = decompressed.toString("utf-8");
      const type = decompressedString.split(" ")[0];
      process.stdout.write(type);
    } else if (process.argv[3] === "-s") {
      const decompressedString = decompressed.toString("utf-8");
      const size = decompressedString.split(" ")[1].split("\0")[0];
      process.stdout.write(size);
    }
  } catch (err) {
    console.log(err);
  }
};

exports.createHash = (process) => {
  try {
    const filepath = process.argv[4];
    const content = fs.readFileSync(
      path.join(process.cwd(), filepath),
      "utf-8"
    );
    const contentSize = content.length;
    const contentToBeHashed = `blob ${contentSize}\0${content}`;

    const hash = crypto
      .createHash("sha1")
      .update(contentToBeHashed)
      .digest("hex");

    const objectDir = path.join(
      process.cwd(),
      `.git/objects/${hash.substring(0, 2)}`
    );
    const objectFilePath = path.join(objectDir, `${hash.substring(2)}`);

    if (!fs.existsSync(objectDir)) {
      fs.mkdirSync(objectDir, { recursive: true });
    }

    const compressedContent = zlib.deflateSync(contentToBeHashed);

    fs.writeFileSync(objectFilePath, compressedContent);
    process.stdout.write(hash);
  } catch (err) {
    console.log(err);
  }
};

function readObject(sha) {
  const objectDir = path.join(".git", "objects", sha.slice(0, 2));
  const objectFile = path.join(objectDir, sha.slice(2));

  const compressedData = fs.readFileSync(objectFile);
  return zlib.inflateSync(compressedData);
}

function parseTree(treeData) {
  let headerEnd = treeData.indexOf(0);
  const rest = treeData.slice(headerEnd + 1);

  let entries = [];
  let offset = 0;

  while (offset < rest.length) {
    const modeEnd = rest.indexOf(32, offset); // Find the next space character
    const mode = rest.slice(offset, modeEnd).toString();

    // Extract the name (up to the null byte)
    const nameEnd = rest.indexOf(0, modeEnd + 1);
    const name = rest.slice(modeEnd + 1, nameEnd).toString();

    // Extract the 20-byte SHA-1 hash following the null byte
    const sha = rest.slice(nameEnd + 1, nameEnd + 21).toString("hex"); // Convert to hex for readability

    entries.push({ mode, name, sha });

    offset = nameEnd + 21; // Move to the next entry
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Implementation of ls-tree command.
 * @param {string} sha - The tree SHA to inspect.
 * @param {boolean} nameOnly - Whether to display only names.
 */
exports.lsTree = (sha) => {
  // console.log(sha);
  const treeData = readObject(sha); // Get the decompressed tree data
  const entries = parseTree(treeData); // Parse the tree entries

  // Full output (mode, type, SHA, name)
  if ("--name-only" === process.argv[3]) {
    entries.forEach((entry) => {
      process.stdout.write(`${entry.name}`);
    });
  } else {
    entries.forEach((entry) => {
      const type = entry.mode === "040000" ? "tree" : "blob";
      process.stdout.write(`${entry.mode} ${type} ${entry.sha} ${entry.name}`);
    });
  }
};
