import process from "process";

import { DB_FILE_PATH, CONFIG_FILE_PATH, BIN_PATH } from "./constants";

// --db=</database/path>
// --config=</config/path>
// --bin=</bin/path/auth_pam.bin>

let dbFilePath = DB_FILE_PATH;
let configFilePath = CONFIG_FILE_PATH;
let binPath = BIN_PATH;

const args = process.argv.slice(2);

for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--db=")) {
        dbFilePath = arg.split("=")[1];
    } else if (arg.startsWith("--config=")) {
        configFilePath = arg.split("=")[1];
    } else if (arg.startsWith("--bin=")) {
        binPath = arg.split("=")[1];
    }
}

export { dbFilePath, configFilePath, binPath };