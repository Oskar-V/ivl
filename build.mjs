import dts from 'bun-plugin-dts'

await Bun.build({
	entrypoints: ['./src/index.ts'],
	outdir: './lib',
	minify: true,
	plugins: [dts()]
})
