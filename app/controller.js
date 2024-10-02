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
