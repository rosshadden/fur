#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const pkg = require('../package.json');
const proc = require('child_process');

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

	const argv = require('yargs')
		.usage('Usage: $0 <cmd>')
		.alias('h', 'help')
		.alias('v', 'version')
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
	.argv;
}

async function getHandler(mod, id, options) {
	if (!modules[mod]) throw new Error(`Group not found: ${mod}`);
	if (!modules[mod][id]) throw new Error(`ID not found in group: ${id}`);
	const cmd = modules[mod][id];

	const list = proc.exec(cmd);
	const finder = proc.spawn(options.finder, [], { stdio: [ 'pipe', 'pipe', 'inherit' ] });

	list.stdout.pipe(finder.stdin);

	for await (const data of finder.stdout) {
		return data.toString().trim();
	}
}

main();
