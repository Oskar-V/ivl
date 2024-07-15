import dts from 'bun-plugin-dts'

await Bun.build({
	entrypoints: ['./src/index.ts'],
	outdir: './lib',
	minify: true,
	plugins: [dts()]
})

await Bun.build({
	entrypoints: ['./src/patterns/index.ts'],
	outdir: './lib/patterns',
	minify: true,
	plugins: [dts()]
})

await Bun.build({
	entrypoints: ['./src/helpers/index.ts'],
	outdir: './lib/helpers',
	minify: true,
	plugins: [dts()]
})