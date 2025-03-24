#!/usr/bin/env node

import { parseBuffer } from "bplist-parser";
import { spawnSync } from "child_process";
import fs from "fs";
import { userInfo } from "os";
import { verbose } from "sqlite3";

const QUERY_INTERVAL = 5_000;
const MAX_CONSECUTIVE_ERRORS = 5;

const script = process.argv[2];

if (!script) {
    console.log("Please provide a script file");
    process.exit(1);
}

try {
    const stat = fs.statSync(script);

    const owner = (stat.mode >>> 6) & 7;
    const execute = 1;

    if ((owner & execute) === 0) {
        console.error("File", script, "is not executable");
        process.exit(1);
    }
} catch {
    console.error("File", script, "does not exist");
    process.exit(1);
}

const username = userInfo().username;
const dbPath = `/Users/${username}/Library/Group Containers/group.com.apple.usernoted/db2/db`;

const sqlite3 = verbose();
const db = new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READONLY,
    (error) => {
        if (error) {
            console.error(
                "Error connecting to database",
                dbPath,
                error.message
            );
            process.exit(1);
        }
    }
);

function close() {
    console.log("Signal received, closing database");

    try {
        db.close();
    } catch (error) {
        console.error("Cannot close database", error);
    }

    process.exit(0);
}

process.on("SIGINT", close);
process.on("SIGKILL", close);

const _2001_01_01 = new Date("2001-01-01").getTime();

const startDate = (Date.now() - _2001_01_01) / 1000;

let lastId = 0;
let errors = 0;

function loop() {
    db.all(
        `SELECT rec_id, app_id, data, delivered_date FROM record
WHERE rec_id > ${lastId}
AND delivered_date > ${startDate}
ORDER BY rec_id ASC`,
        (error, rows) => {
            if (error) {
                console.error("QUERY ERROR:", error.message);

                if (++errors > MAX_CONSECUTIVE_ERRORS) {
                    console.error(
                        "Too many errors, closing down"
                    );

                    db.close();
                    process.exit(1);
                }

                return;
            }

            if (rows.length === 0) {
                return;
            }

            errors = 0;

            try {
                for (let i = 0; i < rows.length; i++) {
                    const row: any = rows[i];

                    const [data] = parseBuffer(row.data);

                    const id = row.rec_id;
                    // const app_id = row.app_id;
                    const app = data?.app;
                    const title = data?.req?.titl;
                    const subtitle = data?.req?.subt;
                    const body = data?.req?.body;
                    const date =
                        data?.date &&
                        new Date(
                            _2001_01_01 + data.date * 1000
                        );

                    console.log("received", id, "from", app);

                    spawnSync(
                        script,
                        [
                            id || "",
                            app || "",
                            title || "",
                            subtitle || "",
                            body || "",
                            date?.toISOString() || "",
                        ],
                        {
                            encoding: "utf8",
                        }
                    );

                    if (i === rows.length - 1) {
                        lastId = id;
                    }
                }
            } catch (error) {
                console.error("Unexpected error", error);
            }
        }
    );

    setTimeout(loop, QUERY_INTERVAL);
}

loop();
