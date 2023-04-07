const fs = require('fs');
const path = require('path');

const src_dir = 'src/shader';

function getDateTime() {
  var date = new Date();

  var hour = date.getHours();
  hour = (hour < 10 ? '0' : '') + hour;

  var min = date.getMinutes();
  min = (min < 10 ? '0' : '') + min;

  var sec = date.getSeconds();
  sec = (sec < 10 ? '0' : '') + sec;

  var year = date.getFullYear();

  var month = date.getMonth() + 1;
  month = (month < 10 ? '0' : '') + month;

  var day = date.getDate();
  day = (day < 10 ? '0' : '') + day;

  return year + ':' + month + ':' + day + ':' + hour + ':' + min + ':' + sec;
}

(async () => {
  const shader_codes = {};
  const files = await fs.promises.readdir(src_dir);
  for (const file of files) {
    const buff = await fs.promises.readFile(path.join(src_dir, file));
    const code = buff.toString('base64');
    shader_codes[file] = code;
  }
  let shader_code =
    'export const shaders = ' + JSON.stringify(shader_codes) + ';\n';
  shader_code += `console.log("loading webgui, build time = ${getDateTime()}");\n`;
  await fs.promises.writeFile('src/shaders.ts', shader_code);
})();
