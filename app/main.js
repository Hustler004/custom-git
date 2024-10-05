const controller = require("./controller");

// You can use print statements as follows for debugging, they'll be visible when running tests.
// console.log("Logs from your program will appear here!");
// Uncomment this block to pass the first stage
const command = process.argv[2];

switch (command) {
  case "init":
    controller.createGitDirectory(process);
    break;
  case "cat-file":
    controller.readBlob(process);
    break;
  case "hash-object":
    const filepath = process.argv[4];
    controller.createHash(filepath);
    break;
  case "ls-tree":
    const hash = process.argv[4];
    controller.lsTree(hash);
    break;
  case "write-tree":
    controller.writeTree(process.cwd());
    break;
  case "commit-tree":
    controller.commitTree(process);
    break;
  default:
    throw new Error(`Unknown command ${command}`);
}
