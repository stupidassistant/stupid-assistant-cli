#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const fs = require("fs");
const node_fetch_1 = require("node-fetch");
const path = require("path");
const fsAsync = require("./fsAsync");
const archiver = require("archiver");
const _ = require("lodash");
const tmp = require("tmp");
const FormData = require("form-data");
program
    .version('0.0.1');
program
    .command('init')
    .description('initialise a project')
    .action(function (env, options) {
    let projectRootDir = process.cwd();
    console.log();
    console.log("- Retreving files from servers");
    return node_fetch_1.default('https://api.stupidassistant.com/cli/templateFiles')
        .then(res => {
        console.log("- Received files");
        return res.json();
    })
        .then(json => {
        if (json.error)
            return console.log("Failed fetching template blueprint from server");
        console.log("- Writing files");
        return Promise.resolve(json.fileList.map((v) => __awaiter(this, void 0, void 0, function* () {
            let dir = path.join(projectRootDir, v.name);
            if (!fs.existsSync(path.dirname(dir)))
                fs.mkdirSync(path.dirname(dir));
            console.log("  + " + v.name);
            return fs.writeFileSync(dir, v.body);
        }))).then(v => {
            console.log("- Finished initialising project");
            console.log();
        });
    });
});
var CONFIG_DEST_FILE = ".runtimeconfig.json";
var _pipeAsync = function (from, to) {
    return new Promise(function (resolve, reject) {
        to.on("finish", resolve);
        to.on("error", reject);
        from.pipe(to);
    });
};
var packageSource = function (sourceDir) {
    var tmpFile = tmp.fileSync({ prefix: "firebase-functions-", postfix: ".zip" }).name;
    var fileStream = fs.createWriteStream(tmpFile, {
        flags: "w",
        encoding: "binary"
    });
    var archive = archiver("zip");
    var archiveDone = _pipeAsync(archive, fileStream);
    let ignore = ["node_modules"];
    return fsAsync.readdirRecursive({ path: sourceDir, ignore: ignore })
        .then(function (files) {
        _.forEach(files, function (file) {
            archive.file(file.name, {
                name: path.relative(sourceDir, file.name),
                mode: file.mode,
            });
        });
        archive.append(JSON.stringify({}, null, 2), {
            name: CONFIG_DEST_FILE,
            mode: 420 /* 0o644 */
        });
        archive.finalize();
        return archiveDone;
    })
        .then(function () {
        return {
            file: tmpFile,
            stream: fs.createReadStream(tmpFile),
            size: archive.pointer(),
        };
    }, function (err) {
        throw console.log("Could not read source directory. Remove links and shortcuts and try again.", {
            original: err,
            exit: 1,
        });
    });
};
function uploadSource(source) {
    return __awaiter(this, void 0, void 0, function* () {
        const form = new FormData();
        form.append("Content-Type", "application/octect-stream");
        form.append('file', source.stream);
        return node_fetch_1.default('https://api.stupidassistant.com/uploadPackage', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
            },
            body: form
        }).then(data => {
            return data.json();
        }).then(data => {
            console.log(JSON.stringify(data));
        }).catch(err => {
            console.log(err);
        });
    });
}
;
program
    .command('deploy')
    .description('initialise a project')
    .action(function (env, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const projectRootDir = process.cwd();
        console.log();
        const source = yield packageSource(projectRootDir);
        if (!source) {
            return;
        }
        try {
            yield uploadSource(source);
            // console.log(
            //   clc.green.bold("functions:") +
            //     " " +
            //     clc.bold(options.config.get("functions.source")) +
            //     " folder uploaded successfully"
            // );
        }
        catch (err) {
            // console.log(clc.yellow("functions:") + " Upload Error: " + err.message);
            throw err;
        }
    });
});
program
    .command('verify')
    .description('verify the project')
    .option('-s, --setup_mode [mode]', 'Which setup mode to use')
    .action(function (env, options) {
    let projectRootDir = process.cwd();
    console.log(projectRootDir);
});
program.parse(process.argv);
