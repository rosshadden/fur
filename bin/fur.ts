#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const pkg = require('../package.json');
const proc = require('child_process');
const yargs = require('yargs');

const cache = {};
const modules = {};

async function init() {
	const modulePath = path.join(__dirname, '../modules');
	const moduleFiles = await fs.readdir(modulePath);

	for (const file of moduleFiles) {
		modules[path.basename(file, '.json')] = require(path.join(modulePath, file));
	}
}

async function main() {
	await init();

	yargs
		.usage('Usage: $0 <cmd>')
		.alias('h', 'help')
		.alias('v', 'version')
		.options({
			finder: {
				default: 'fzf',
			},
		})
		.command(
			'list [module]',
			'List all available profiles.',
			{},
			async (argv) => {
				let container = modules;
				if (argv.module) container = modules[argv.module];

				for (const mod of Object.keys(container)) {
					console.log(mod);
				}
			},
		)
		.command(
			[ 'get <module> <id>', '$0 <module> <id>' ],
			'Get one result from an input list for a given <id>, typically via user input through a fuzzy finder.',
			{
				d: {
						alias: 'default',
				},
				f: {
						alias: 'finder',
						default: 'fzf',
				},
				p: {
						alias: 'prompt',
				},
			},
			async (argv) => {
				const result = await getHandler(argv.module, argv.id, argv);
				console.log(result);
			},
		)
		.command(
			'set <id>',
			'Set default for a given <id>.',
			{},
			(argv) => {
				console.log('set', argv);
			},
		)
		.command(
			'exec <cmd>',
			`Execute command, fulfilling substitution using \`${pkg.name} get\`.`,
			{
				d: {
					alias: 'dry',
					describe: 'Output the command that would be run instead of running it.',
				},
				f: {
					alias: 'force',
					describe: 'Force multiple occurrences of repeating ids to all require choices, rather than reusing one answer for all.',
				},
			},
			async (argv) => {
				const result = await execHandler(argv.cmd, argv);
			},
		)
	.argv;
}

async function exec(cmd, options: any = {}) {
	const queries = [];

	const matches = cmd.matchAll(/#{([\w\-]+) ([\w\-]+)}/g);
	for (const match of matches) {
		const [ , mod, id ] = match;
		queries.push(
			getHandler(mod, id, options)
				.then((result) => {
					cmd = cmd.replace(`#{${mod} ${id}}`, result);
					return result;
				})
		);
	}

	await Promise.all(queries);

	if (options.dry) return console.log(cmd);
	return proc.exec(cmd);
}

async function getHandler(mod, id, options) {
	if (!modules[mod]) throw new Error(`Group not found: ${mod}`);
	if (!modules[mod][id]) throw new Error(`ID not found in group: ${id}`);

	const cmd = modules[mod][id];
	const key = `${mod}:${id}`;
	// console.log('cmd:', key, cmd);

	// console.log('CACHE CHECK', key);
	if (cache[key]) {
		// console.log('CACHE GET', key, cache[key]);
		return cache[key];
	}

	const list = await exec(cmd, options);
	const finder = proc.spawn(options.finder, [], { stdio: [ 'pipe', 'pipe', 'inherit' ] });

	list.stdout.pipe(finder.stdin);

	for await (const data of finder.stdout) {
		const result = data.toString().trim();
		cache[key] = result;
		// console.log('CACHE SET', key, result);
		return result;
	}
}

async function execHandler(cmd, options) {
	const child = await exec(cmd, options);
	child.stdout.pipe(process.stdout);
}

main();
