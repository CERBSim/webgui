const fs = require( 'fs' );
const path = require( 'path' );

const src_dir = "src/shader";

(async ()=>{
    const shader_codes = {};
    const files = await fs.promises.readdir( src_dir );
    for( const file of files ) {
        const buff = await fs.promises.readFile( path.join( src_dir, file ) );
        const code = buff.toString('base64');
        shader_codes[file] = code;
    }
    const shader_code = "export const shaders = " + JSON.stringify(shader_codes) + ";";
    await fs.promises.writeFile( "src/shaders.ts", shader_code );
})();

