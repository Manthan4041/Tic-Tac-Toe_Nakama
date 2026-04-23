const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const json = require('@rollup/plugin-json');

module.exports = {
  input: 'src/main.ts',
  output: {
    file: 'build/index.js',
    format: 'cjs',
    sourcemap: false,
  },
  external: [],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
    json(),
  ],
};
