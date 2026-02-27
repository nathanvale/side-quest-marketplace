export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		// Remove hard line-length limits in commit body/footer to reduce friction
		'body-max-line-length': [0, 'always'],
		'footer-max-line-length': [0, 'always'],
		// Keep header length reasonable but not draconian
		'header-max-length': [2, 'always', 100],
		// Encourage clear types and non-empty subject
		'type-enum': [
			2,
			'always',
			[
				'feat',
				'fix',
				'docs',
				'style',
				'refactor',
				'perf',
				'test',
				'build',
				'ci',
				'chore',
				'revert',
			],
		],
		'subject-empty': [2, 'never'],
	},
}
