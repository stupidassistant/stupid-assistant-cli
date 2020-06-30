#!/usr/bin/env node

import * as program from 'commander';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import * as fsAsync from "./fsAsync";
import * as archiver from "archiver";
import * as _ from "lodash";
import * as tmp from "tmp";
import * as FormData from "form-data";

program
  .version('0.0.1')

program
  .command('init')
  .description('initialise a project')
  .action(function(env, options) {
    let projectRootDir = process.cwd();
    
    console.log();
    console.log("- Retreving files from servers");
    return fetch('https://api.stupidassistant.com/cli/templateFiles')
      .then(res => {
        console.log("- Received files");
        return res.json();
      })
      .then(json => {
        if (json.error)
          return console.log("Failed fetching template blueprint from server");
        
        console.log("- Writing files");
        return Promise.resolve(json.fileList.map(async (v: {name: string, body: string}) => {
          let dir = path.join(projectRootDir, v.name);

          if (!fs.existsSync(path.dirname(dir)))
            fs.mkdirSync(path.dirname(dir));
            
          console.log("  + " + v.name);
          return fs.writeFileSync(dir, v.body);
        })).then(v => {
          console.log("- Finished initialising project");
          console.log();
        });
      });
  });

  var CONFIG_DEST_FILE = ".runtimeconfig.json";

  var _pipeAsync = function(from: archiver.Archiver, to: any) {
    return new Promise(function(resolve, reject) {
      to.on("finish", resolve);
      to.on("error", reject);
      from.pipe(to);
    });
  };

  var packageSource = function(sourceDir: string) {
    var tmpFile = tmp.fileSync({ prefix: "firebase-functions-", postfix: ".zip" }).name;
    var fileStream = fs.createWriteStream(tmpFile, {
      flags: "w",
      encoding: "binary"
    });
    var archive = archiver("zip");
    var archiveDone = _pipeAsync(archive, fileStream);
  
    let ignore: string[] = ["node_modules"];

    return fsAsync.readdirRecursive({ path: sourceDir, ignore: ignore })
      .then(function(files) {
        _.forEach(files, function(file) {
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
      .then(
        function() {
          return {
            file: tmpFile,
            stream: fs.createReadStream(tmpFile),
            size: archive.pointer(),
          };
        },
        function(err) {
          throw console.log(
            "Could not read source directory. Remove links and shortcuts and try again.",
            {
              original: err,
              exit: 1,
            }
          );
        }
      );
  };

async function uploadSource(source: any): Promise<boolean> {
  const form = new FormData();
  form.append("Content-Type", "application/octect-stream");
  form.append('file', source.stream);

  return fetch('https://api.stupidassistant.com/uploadPackage', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      // 'Authorization': accessToken,
    },
    body: form
  }).then((data: any) => {
    return data.json();
  }).then((data: any) => {
    if (data.error)
      return false;
    else 
      return true;
  }).catch((err: any) => {
    return false
  });
};

program
  .command('deploy')
  .description('initialise a project')
  .action(async function(env, options) {
    const projectRootDir = process.cwd();
    console.log();
    
    console.log("Deploying project to servers");
    const source = await packageSource(projectRootDir);

    if (!source) {
      console.log("- Failed zipping package ");
      console.log();
      return;
    }

    console.log("- Zipped package for uploading");
    try {
      let result = await uploadSource(source);
      if (result == true) {
        console.log("- Uploaded package (Congrats!)");
      } else {
        console.log("- Failed uploading package");
      }
    } catch (err) {
      // console.log(clc.yellow("functions:") + " Upload Error: " + err.message);
      throw err;
    }
    console.log()
  });

program
  .command('verify')
  .description('verify the project')
  .option('-s, --setup_mode [mode]', 'Which setup mode to use')
  .action(function(env, options) {
    let projectRootDir = process.cwd();
    console.log(projectRootDir)
  });

program.parse(process.argv);