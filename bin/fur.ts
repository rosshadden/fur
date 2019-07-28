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
			'get <id>',
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
				const [ group, id ] = argv.id.split(':');
				if (!modules[group]) throw new Error(`Group not found: ${group}`);
				if (!modules[group][id]) throw new Error(`ID not found in group: ${id}`);
				const cmd = modules[group][id];

				const list = proc.exec(cmd);
				const finder = proc.spawn(argv.finder, [], { stdio: [ 'pipe', 'pipe', 'inherit' ] });

				list.stdout.pipe(finder.stdin);

				for await (const data of finder.stdout) {
					const output = data.toString().trim()
					console.log(output);
				}
			},
		)
	.argv;
}

main();
