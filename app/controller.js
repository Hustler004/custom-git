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

exports.createHash = (filepath) => {
  try {
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
    return hash;
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
    if (offset + 21 > rest.length) break;
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
  // console.log("sha");
  const treeData = readObject(sha); // Get the decompressed tree data
  const entries = parseTree(treeData); // Parse the tree entries
  // Full output (mode, type, SHA, name)
  if ("--name-only" === process.argv[3]) {
    entries.forEach((entry) => {
      console.log(`${entry.name}`);
    });
  } else {
    entries.forEach((entry) => {
      const type = entry.mode === "040000" ? "tree" : "blob";
      process.stdout.write(`${entry.mode} ${type} ${entry.sha} ${entry.name}`);
    });
  }
};

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  const header = `blob ${content.length}\0`;
  const store = Buffer.concat([Buffer.from(header), content]);

  const hash = crypto.createHash("sha1").update(store).digest("hex");
  const objectDir = path.join(
    process.cwd(),
    `.git/objects/${hash.substring(0, 2)}`
  );
  const objectFilePath = path.join(objectDir, `${hash.substring(2)}`);

  if (!fs.existsSync(objectDir)) {
    fs.mkdirSync(objectDir, { recursive: true });
  }

  const compressedContent = zlib.deflateSync(store);
  fs.writeFileSync(objectFilePath, compressedContent);

  return Buffer.from(hash, "hex"); // Return the binary hash (20 bytes)
}

// Recursive function to write the tree object
function writeTreeHelper(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  let contentBuffers = [];

  entries.forEach((entry) => {
    const fullpath = path.join(directory, entry.name);
    if (entry.name === ".git") return;

    let mode, hash;
    if (entry.isDirectory()) {
      mode = "40000"; // Directory mode
      hash = writeTreeHelper(fullpath); // Recurse into subdirectory
    } else if (entry.isFile()) {
      mode = "100644"; // Regular file mode
      hash = hashFile(fullpath); // Hash the file and return its binary SHA-1 hash
    }

    // Append the mode, filename, null byte, and the binary SHA-1 hash
    const entryContent = Buffer.concat([
      Buffer.from(`${mode} ${entry.name}\0`, "utf-8"), // Mode and filename followed by null byte
      hash, // Binary SHA-1 hash
    ]);
    contentBuffers.push(entryContent);
  });

  // Concatenate all tree entries into a single buffer
  const content = Buffer.concat(contentBuffers);
  const header = Buffer.from(`tree ${content.length}\0`);
  const treeObject = Buffer.concat([header, content]);

  // Compute SHA-1 hash of the tree object
  const treeHash = crypto.createHash("sha1").update(treeObject).digest("hex");
  const objectDir = path.join(
    process.cwd(),
    `.git/objects/${treeHash.substring(0, 2)}`
  );
  const objectFilePath = path.join(objectDir, `${treeHash.substring(2)}`);

  // Store the tree object in the Git object store
  if (!fs.existsSync(objectDir)) {
    fs.mkdirSync(objectDir, { recursive: true });
  }

  const compressedContent = zlib.deflateSync(treeObject);
  fs.writeFileSync(objectFilePath, compressedContent);

  return Buffer.from(treeHash, "hex"); // Return the binary hash of the tree object
}

// Entry point for writing the tree
exports.writeTree = (directory) => {
  const treeHash = writeTreeHelper(directory);
  console.log(treeHash.toString("hex")); // Output the hash in hexadecimal form
};
