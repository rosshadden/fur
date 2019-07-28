#!/usr/bin/env node

const pkg = require('../package.json');
const proc = require('child_process');
const registry = require('../registry.json');

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
			if (!registry[group]) throw new Error(`Group not found: ${group}`);
			if (!registry[group][id]) throw new Error(`ID not found in group: ${id}`);
			const cmd = registry[group][id];

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
