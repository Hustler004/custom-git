const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");
// Uncomment this block to pass the first stage
const command = process.argv[2];

switch (command) {
  case "init":
    createGitDirectory();
    break;
  case "cat-file":
    readBlob();
    break;
  default:
    throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
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
}

function readBlob() {
  try {
    const hash = process.argv[4];
    const sub_dir = hash.substring(0, 2);
    const filename = hash.substring(2);
    const content = fs.readFileSync(
      path.join(process.cwd(), `.git/objects/${sub_dir + "/" + filename}`)
      // "utf-8"
    );

    const decompressed = zlib.inflateSync(content);
    const nullCharIndex = decompressed.indexOf(0);

    // Extract the actual content after the null character
    const actualContent = decompressed.slice(nullCharIndex + 1);

    // Convert the content to a string (assuming utf-8 encoding)
    const decompressedString = actualContent.toString("utf-8");
    console.log(decompressedString);
  } catch (err) {
    console.log(err);
  }
}
