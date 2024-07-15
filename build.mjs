import dts from 'bun-plugin-dts'

await Bun.build({
	entrypoints: ['./src/index.ts', './src/patterns/index.ts', './src/helpers/index.ts'],
	outdir: './lib',
	minify: true,
	plugins: [dts()]
})
