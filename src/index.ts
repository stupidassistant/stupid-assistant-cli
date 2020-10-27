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
import { configstore } from './configstore';

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
      .then((fileList: Record<string, string>) => {
        console.log("- Writing files");

        return Promise.resolve(Object.keys(fileList).map(async (name: string) => {
          let dir = path.join(projectRootDir, name);

          if (!fs.existsSync(path.dirname(dir)))
            fs.mkdirSync(path.dirname(dir));
            
          console.log("  + " + name);
          return fs.writeFileSync(dir, fileList[name]);
        })).then(v => {
          console.log("- Finished initialising project");
          console.log();
        });
      }).catch(() => {
        console.log("- Failed fetching template blueprint from server");
        console.log();
      });;
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

async function uploadSource(source: any): Promise<{
  error: boolean,
  message: string,
  errorMessages: string[]
}> {
  const form = new FormData();
  form.append("Content-Type", "application/octect-stream");
  form.append('file', source.stream);
  
  const token = configstore.get("token");

  return fetch('https://api.stupidassistant.com/uploadPackage', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': token,
    },
    body: form
  }).then((data: any) => {
    return data.json();
  }).catch((err: any) => {
    return {
      error: false
    }
  });
};

program
  .command('deploy')
  .description('deploy a project')
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
      if (result.error != true) {
        console.log("- Uploaded package (Congrats!)");
      } else {
        console.log("- Failed uploading package");

        if (result.errorMessages) {
          result.errorMessages.forEach(m => {
            console.log("  - " + m);
          })
        }
      }
    } catch (err) {
      console.log(`  - Error: ${err}`);
      throw err;
    }
    console.log()
  });
  
program
  .command('useToken <token>')
  .description('use an Deployment Token')
  .action(async function(token, options) {
    configstore.set("token", token);
    console.log("Stored Token");
  });

program
  .command('getToken')
  .description('use an Deployment Token')
  .action(async function(options) {
    const token = configstore.get("token");
    console.log(`Your current token is "${token}"`);
  });


program
  .command('verifyToken')
  .description('use an Deployment Token')
  .action(async function(options) {
    const token = configstore.get("token");

    const valid = await verifyDeploymentToken(token);
    console.log(`Your deployment token is ${valid ? "VALID" : "INVALID"}`);
  });

program
  .command('getOrgs')
  .description('use an Deployment Token')
  .action(async function(options) {
    const token = configstore.get("token");
    const organisations = await getOrgs(token);

    console.log("Your teams are:");
    Object.keys(organisations).forEach(orgId => {
      console.log(`- ${organisations[orgId].teamName} (${orgId})`);
    });
  });

async function verifyDeploymentToken(verifyDeploymentToken: string): Promise<boolean> {
  return fetch('https://api.stupidassistant.com/deploymentToken/verify', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': verifyDeploymentToken,
    }
  }).then((data: any) => {
    return data.json();
  }).then((data: any) => {
    return data.valid || false;
  }).catch((err: any) => {
    return false
  });
};

async function getOrgs(verifyDeploymentToken: string): Promise<Record<string, {
  teamName: string,
  membershipType: string
}>> {
  return fetch('https://api.stupidassistant.com/deploymentToken/organisations', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': verifyDeploymentToken,
    }
  }).then((data: any) => {
    return data.json();
  }).then((data: any) => {
    return data.organisations || {};
  }).catch((err: any) => {
    return false
  });
};

program.parse(process.argv);