/*
 * Script that uploads the requied files to build an NFT to ipfs protocol
 *
 * Usage:
 * truffle exec scripts/ipfsNFTUpload.js imageDirectory jsonDirectory [configPath]
 * Arguments:
 *    - imageDirectory:  Path to the directory containing the nft images
 *    - jsonDirectory:   Path to the directory containing the nft json data
 *    - configPath: Path to override the default configuration file (pinata.conf)
 *
 * Config Json object
 * {
 *   "api_key": "...",
 *   "api_secret" : "...",
 *   "jwt" : "...",
 *   "FRA1": ...,
 *   "NYC1": ...
 * }
 */

const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");

const pinata_endpoint = "https://gateway.pinata.cloud/ipfs/";

if (process.argv.length < 6) {
  console.log("Missing arguments.");
  console.log("Please run : ");
  console.log("truffle exec scripts/ipfsNFTUpload.js imageDirectory jsonDirectory ");

  process.exit(2);
}

let configPath = "../pinata.json";
if (process.argv.length == 7) {
  configPath = process.argv[6];
}

if (!fs.existsSync(configPath)) {
  console.log("config file (" + configPath + ") doesn't exist ");
  process.exit(2);
}

let configContents = fs.readFileSync(configPath, "utf8");
let config = JSON.parse(configContents);

const api_key = config.api_key;
const api_secret = config.api_secret;

const imageDirectory = process.argv[4];
const metadataDirectory = process.argv[5];

async function uploadImage(imagePath, api_key, api_secret) {
  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  let pinataFileOptions = JSON.stringify({
    cidVersion: 1,
    customPinPolicy: {
      regions: [
        {
          id: "FRA1",
          desiredReplicationCount: 1,
        },
        {
          id: "NYC1",
          desiredReplicationCount: 1,
        },
      ],
    },
  });

  let pinataMetadata = JSON.stringify({
    name: "nftImage",
  });

  let data = new FormData();
  data.append("file", fs.createReadStream(imagePath));
  data.append("pinataMetadata", pinataMetadata);
  data.append("pinataOptions", pinataFileOptions);

  return axios.post(url, data, {
    maxBodyLength: "Infinity", //this is needed to prevent axios from erroring out with large files
    headers: {
      "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
      pinata_api_key: api_key,
      pinata_secret_api_key: api_secret,
    },
  });
}

async function uploadToDirectory(filenames, api_key, api_secret) {
  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  let pinataFileOptions = JSON.stringify({
    // wrapWithDirectory: true,
    cidVersion: 1,
    customPinPolicy: {
      regions: [
        {
          id: "FRA1",
          desiredReplicationCount: 1,
        },
        {
          id: "NYC1",
          desiredReplicationCount: 1,
        },
      ],
    },
  });

  let pinataMetadata = JSON.stringify({
    name: "nftMetaData",
  });

  let data = new FormData();

  for (i = 0; i < filenames.length; i++) {
    tokenId = path.parse(filenames[i]).name;
    data.append("file", fs.createReadStream(filenames[i]), { filepath: "nft/" + tokenId });
  }

  data.append("pinataMetadata", pinataMetadata);
  data.append("pinataOptions", pinataFileOptions);

  return axios.post(url, data, {
    maxBodyLength: "Infinity", //this is needed to prevent axios from erroring out with large files
    headers: {
      "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
      pinata_api_key: api_key,
      pinata_secret_api_key: api_secret,
    },
  });
}

let data = [];
let uploadJsonFiles = [];

module.exports = async (deployer, network, accounts) => {
  imageFiles = fs.readdirSync(imageDirectory);
  jsonFiles = fs.readdirSync(metadataDirectory);

  if (imageFiles.length != jsonFiles.length) {
    console.log("Mismatch in images and json files");
    process.exit(1);
  }

  console.log("Image ipfs upload : ");

  for (i = 0; i < imageFiles.length; i++) {
    request = uploadImage(imageDirectory + "/" + imageFiles[i], api_key, api_secret);
    let response = await request;
    data[i] = response.data;

    // Update json files with NFT data
    filename = metadataDirectory + "/" + jsonFiles[i];
    uploadJsonFiles.push(filename);

    imageProp = "ipfs://" + data[i].IpfsHash;
    jsonFileContent = fs.readFileSync(filename, "utf8");
    metadata = JSON.parse(jsonFileContent);
    metadata.image = imageProp;
    fs.writeFileSync(filename, JSON.stringify(metadata));

    console.log(imageFiles[i] + "  => " + imageProp);
    console.log(" ".repeat(imageFiles[i].length) + "  => " + pinata_endpoint + data[i].IpfsHash);
  }

  metadataRequest = uploadToDirectory(uploadJsonFiles, api_key, api_secret);
  let response = await metadataRequest;

  console.log("Metadata : ");

  var ipfs_CID = response.data.IpfsHash;

  jsonFiles.map((item) => {
    let name = path.parse(item).name;

    console.log(item + "  => ipfs://" + ipfs_CID + "/" + name);
    console.log(" ".repeat(item.length) + "  => " + pinata_endpoint + ipfs_CID + "/" + name);
  });
};
